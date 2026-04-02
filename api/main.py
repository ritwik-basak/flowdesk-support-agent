"""
FastAPI backend for Flowdesk Support Agent.
Exposes the multi-agent pipeline via REST + SSE streaming endpoints.

Uses lifespan for startup — models load in the background so port 8080
is ready immediately, avoiding Cloud Run startup timeout.
"""

import asyncio
import json
import uuid
import os
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from feedback.feedback_store import store_feedback, get_feedback_summary
from evaluation.metrics_store import get_metrics_summary, get_top_failing_queries, get_all_queries, get_session_summary
from rag.pdf_ingestion import upload_to_gcs, ingest_pdf
from utils.logger import get_logger

console = get_logger()

# ---------------------------------------------------------------------------
# Background model loading
# ---------------------------------------------------------------------------

models_loaded = False
run_support_agent = None  # set once models finish loading


def _load_models():
    """Runs in a background thread — imports and warms up the full agent pipeline."""
    global models_loaded, run_support_agent
    console.print("Loading models in background...", style="bold cyan")
    try:
        from agents.graph import run_support_agent as _run
        run_support_agent = _run
        models_loaded = True
        console.print("All models loaded and ready", style="bold green")
    except Exception as e:
        console.print(f"FATAL: Model loading failed: {e}", style="bold red")
        import traceback
        traceback.print_exc()


# ---------------------------------------------------------------------------
# Lifespan — replaces deprecated @app.on_event("startup")
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    console.print("Flowdesk Support Agent API starting...", style="bold green")
    console.print("Endpoints available:", style="bold")
    console.print("  POST /chat", style="cyan")
    console.print("  POST /feedback", style="cyan")
    console.print("  GET  /metrics", style="cyan")
    console.print("  GET  /health", style="cyan")

    # Start model loading in background — port 8080 is already accepting traffic
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _load_models)

    yield  # app runs here


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Flowdesk Support Agent API",
    description="Multi-agent customer support system with RAG and LLMOps",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    session_id: str = None  # auto-generated if not provided


class FeedbackRequest(BaseModel):
    session_id: str
    user_message: str
    agent_answer: str
    feedback_type: str  # "positive" or "negative"


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status": "ok" if models_loaded else "loading",
        "service": "Flowdesk Support Agent",
        "models_ready": models_loaded,
    }


# ---------------------------------------------------------------------------
# Chat endpoint with SSE streaming
# ---------------------------------------------------------------------------

@app.post("/chat")
async def chat(request: ChatRequest):
    if not models_loaded:
        return JSONResponse(
            status_code=503,
            content={"message": "Models still loading, please try again in 60 seconds"},
        )

    session_id = request.session_id or str(uuid.uuid4())
    message = request.message

    async def event_stream():
        try:
            # run_support_agent is synchronous — run it in a thread executor
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: run_support_agent(message, session_id=session_id),
            )

            # Event 1 — session id
            yield {
                "event": "session",
                "data": json.dumps({"session_id": session_id}),
            }

            # Event 2 — metadata
            yield {
                "event": "metadata",
                "data": json.dumps({
                    "confidence": result["confidence"],
                    "action_taken": result["action_taken"],
                    "issue_type": result["issue_type"],
                    "source_docs": result.get("source_docs", []),
                }),
            }

            # Event 3 — stream answer word by word
            words = result["answer"].split(" ")
            for word in words:
                yield {
                    "event": "token",
                    "data": json.dumps({"token": word + " "}),
                }
                await asyncio.sleep(0.05)

            # Event 4 — done signal
            yield {
                "event": "done",
                "data": json.dumps({"done": True}),
            }

        except Exception as e:
            console.print(f"SSE stream error: {e}", style="bold red")
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)}),
            }

    return EventSourceResponse(event_stream())


# ---------------------------------------------------------------------------
# Feedback endpoint
# ---------------------------------------------------------------------------

@app.post("/feedback")
async def feedback(request: FeedbackRequest):
    if request.feedback_type not in ("positive", "negative"):
        raise HTTPException(
            status_code=400,
            detail="feedback_type must be 'positive' or 'negative'",
        )

    success = store_feedback(
        session_id=request.session_id,
        user_message=request.user_message,
        agent_answer=request.agent_answer,
        feedback_type=request.feedback_type,
    )

    if success:
        return {"success": True, "message": "Feedback stored successfully"}
    return {"success": False, "message": "Failed to store feedback"}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if file.content_type not in ("application/pdf", "application/x-pdf") and not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    if not models_loaded:
        return JSONResponse(
            status_code=503,
            content={"message": "Models still loading, please try again in 60 seconds"},
        )

    temp_path = None
    try:
        suffix = os.path.splitext(file.filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(await file.read())
            temp_path = temp_file.name

        upload_to_gcs(temp_path, file.filename)
        result = ingest_pdf(temp_path, file.filename)

        if result.get("status") != "success":
            raise HTTPException(status_code=500, detail=result.get("error", "PDF ingestion failed"))

        return {
            "filename": result["filename"],
            "chunks_created": result["chunks_created"],
            "gcs_uri": result["gcs_uri"],
            "message": "Document successfully added to knowledge base",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


# ---------------------------------------------------------------------------
# Metrics endpoint
# ---------------------------------------------------------------------------

@app.get("/metrics")
async def metrics():
    try:
        metrics_summary = get_metrics_summary()
        failing_queries = get_top_failing_queries()
        feedback_summary = get_feedback_summary()

        return {
            "metrics": metrics_summary,
            "top_failing_queries": failing_queries,
            "feedback": feedback_summary,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Analytics endpoint (detailed — for backend team)
# ---------------------------------------------------------------------------

@app.get("/analytics")
async def analytics():
    try:
        return {
            "queries": get_all_queries(200),
            "sessions": get_session_summary(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Run script
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8080, reload=False)
