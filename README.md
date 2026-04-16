<div align="center">

# Flowdesk Support Agent

## Multi-agent customer support system with RAG, live metrics, and PDF knowledge base uploads

</div>

A full-stack AI-powered support assistant built with FastAPI and React. Flowdesk Support Agent routes user questions through a LangGraph-based multi-agent system, retrieves grounded answers from a Pinecone-backed knowledge base, streams responses live to the UI, tracks operational metrics, and supports PDF uploads into the RAG pipeline.

![Python](https://img.shields.io/badge/Python-3.11+-blue?style=flat&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green?style=flat&logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)
![Vite](https://img.shields.io/badge/Vite-Frontend-646CFF?style=flat&logo=vite)
![LangGraph](https://img.shields.io/badge/LangGraph-Agent_Orchestration-purple?style=flat)
![Pinecone](https://img.shields.io/badge/Pinecone-Vector_Search-green?style=flat)
![Groq](https://img.shields.io/badge/Groq-LLM-orange?style=flat)
![Gemini](https://img.shields.io/badge/Gemini-Intent_Routing-blue?style=flat)
![Google_Cloud_Storage](https://img.shields.io/badge/GCS-PDF_Storage-4285F4?style=flat&logo=googlecloud)

---

## Key Highlights

- Built a production-grade multi-agent customer support system using LangGraph supervisor architecture with dynamic
routing across agents, leveraging Gemini and Groq.
- Implemented hybrid RAG pipeline combining dense vector search (Pinecone + BGE-small), BM25 sparse search, and
CrossEncoder reranking.
- Engineered LLMOps evaluation layer with real-time confidence scoring, structured decision reasoning, self-correction
retry loop with PostgreSQL-based agent memory.
- Deployed a scalable backend on GCP Cloud Run with Docker containerization and automated CI/CD using GitHub
Actions.

---

## Use Cases

- Answer FAQ, billing, and technical support questions with grounded RAG responses
- Escalate ambiguous or low-confidence cases to human support flow
- Track support quality through confidence, escalation rate, and feedback metrics
- Demo knowledge base expansion by uploading new PDF documents through the website
- Prototype a customer support copilot that combines agent routing with retriever-backed answers

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                        React Frontend                       │
│        Chat UI · Metrics Dashboard · Analytics · Upload     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP + SSE
┌──────────────────────────▼──────────────────────────────────┐
│                       FastAPI Backend                       │
│                                                             │
│  POST /chat      -> streams answer tokens + metadata        │
│  POST /feedback  -> stores user feedback                    │
│  GET  /metrics   -> support metrics summary                 │
│  GET  /analytics -> detailed query/session analytics        │
│  POST /upload    -> upload PDF to GCS + ingest to RAG       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │               LangGraph Support Pipeline             │  │
│  │                                                       │  │
│  │ User Query                                            │  │
│  │   -> Supervisor      - classify intent                │  │
│  │   -> FAQ Agent       - general product how-to         │  │
│  │   -> Technical Agent - troubleshooting support        │  │
│  │   -> Billing Agent   - invoices, plans, payments      │  │
│  │   -> Escalation      - human handoff fallback         │  │
│  │   -> Evaluator       - retry or finalize answer       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  RAG Layer                                                  │
│   -> Query rewrite                                          │
│   -> Pinecone dense search                                  │
│   -> BM25 keyword search over chunks.json                   │
│   -> Merge + rerank + compression                           │
└─────────────────────────────────────────────────────────────┘
```

**Agent responsibilities**

| Agent | Role |
|-------|------|
| **Supervisor** | Classifies a user message into `FAQ`, `TECHNICAL`, `BILLING`, or `ESCALATE` |
| **FAQ Agent** | Handles general product usage questions using RAG retrieval |
| **Technical Agent** | Handles troubleshooting, browser, login, sync, and workflow problems |
| **Billing Agent** | Handles plans, payments, invoices, and refund-related content |
| **Escalation Agent** | Returns a fixed human-support escalation response when confidence is too low or the issue is high risk |
| **Evaluator** | Reviews specialist output, decides whether to send, retry, or escalate |

---

## Project Structure

```text
flowdesk-support-agent/
│
├── api/
│   └── main.py                     ← FastAPI app and SSE endpoints
│
├── agents/
│   ├── graph.py                    ← LangGraph orchestration
│   ├── supervisor.py               ← intent classification
│   ├── faq_agent.py                ← FAQ specialist
│   ├── technical_agent.py          ← technical specialist
│   ├── billing_agent.py            ← billing specialist
│   └── escalation_agent.py         ← escalation fallback
│
├── rag/
│   ├── ingestion.py                ← markdown ingestion pipeline
│   ├── pdf_ingestion.py            ← PDF upload ingestion for GCS + Pinecone
│   ├── retriever.py                ← dense + BM25 + rerank retrieval
│   └── embeddings.py               ← embedding model wrapper
│
├── knowledge_base/
│   ├── documents/
│   │   ├── billing.md
│   │   ├── faq.md
│   │   └── technical.md
│   └── chunks.json                 ← chunk store used by BM25 retrieval
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       └── components/
│           ├── ChatInterface.jsx
│           ├── MetricsDashboard.jsx
│           ├── AnalyticsDashboard.jsx
│           └── DocumentUpload.jsx
│
├── evaluation/
│   └── metrics_store.py            ← metrics storage and summaries
├── feedback/
│   └── feedback_store.py           ← feedback persistence
├── memory/
│   └── checkpointer.py             ← conversation memory
├── database/
│   └── connection.py               ← PostgreSQL connection setup
├── config.py
├── Dockerfile
├── requirements.txt
└── README.md
```

---

## Tech Stack

**Frontend**

- React 19
  Purpose: component-based frontend UI for chat, metrics, analytics, and upload flows
- Vite 8
  Purpose: fast frontend dev server and production bundling
- Framer Motion
  Purpose: motion and entrance animations across panels and dashboard transitions
- Lucide React
  Purpose: icon system for chat, metrics, upload, and status UI elements
- Axios
  Purpose: HTTP client used for file upload requests from the frontend
- React Markdown
  Purpose: render markdown-style assistant responses cleanly in the chat UI

**Backend**

- FastAPI
  Purpose: backend API framework for chat, feedback, metrics, analytics, and upload endpoints
- Uvicorn
  Purpose: ASGI server used to run the FastAPI backend locally and in Cloud Run
- LangGraph
  Purpose: orchestrates the multi-agent routing graph and retry flow
- LangChain
  Purpose: shared abstractions for documents, model integration, text splitting, and retrieval utilities
- `sse-starlette`
  Purpose: Server-Sent Events streaming for token-by-token response delivery
- PostgreSQL / Supabase
  Purpose: stores support metrics, session analytics, and user feedback
- `python-multipart`
  Purpose: handles multipart form uploads for PDF ingestion

**AI / Retrieval**

- Groq `llama-3.3-70b-versatile`
  Purpose: LLM used in retrieval steps and answer-generation pipeline components
- Google Gemini `gemini-2.5-flash`
  Purpose: model used by the supervisor for fast intent routing
- `sentence-transformers` with `BAAI/bge-small-en-v1.5` from Hugging Face
  Purpose: embedding model for dense semantic retrieval
- `CrossEncoder` with `cross-encoder/ms-marco-MiniLM-L-6-v2` from Hugging Face
  Purpose: reranks retrieved chunks for better final precision
- Pinecone
  Purpose: vector database for dense chunk storage and semantic search
- `rank-bm25`
  Purpose: keyword-based sparse retrieval over locally stored chunk text
- `TextLoader` from `langchain_community.document_loaders`
  Purpose: loads markdown knowledge-base files into document objects
- `MarkdownHeaderTextSplitter` from `langchain_text_splitters`
  Purpose: splits markdown by heading structure so chunks keep section-level meaning
- `RecursiveCharacterTextSplitter` from `langchain_text_splitters`
  Purpose: further splits large sections into manageable overlapping chunks
- `pypdf`
  Purpose: extracts text from uploaded PDF files before chunking and embedding

**Infrastructure**

- Google Cloud Run
  Purpose: container hosting for the FastAPI backend
- Google Cloud Storage
  Purpose: permanent storage for uploaded PDF knowledge-base documents
- Docker
  Purpose: containerizes the backend for reproducible deployment
- LangSmith
  Purpose: tracing and observability for model calls and agent runs when enabled

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Pinecone API key
- Groq API key
- Gemini API key
- PostgreSQL-compatible database URL
- Optional: LangSmith API key
- Optional: Google Cloud credentials if testing PDF upload locally

---

## Setup

### 1. Backend Setup

#### Create and activate a virtual environment

**Windows**

```bash
python -m venv venv
venv\Scripts\activate
```

**Mac/Linux**

```bash
python3 -m venv venv
source venv/bin/activate
```

#### Install dependencies

```bash
pip install -r requirements.txt
```

#### Create a `.env` file

Create `.env` in the project root:

```env
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=flowdesk-support

GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key

LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=flowdesk-support-agent

DATABASE_URL=your_postgres_connection_string

GCS_BUCKET_NAME=flowdesk-knowledge-base
GOOGLE_APPLICATION_CREDENTIALS=flowdesk-service-account.json
```

#### Run the backend

```bash
python -m api.main
```

Backend runs at:

- `http://localhost:8080`
- Swagger docs: `http://localhost:8080/docs`

---

### 2. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

- `http://localhost:5173`

If you want the frontend to talk to a local backend, create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:8080
```

---

## Usage

1. Start the backend
2. Start the frontend
3. Open the website at `http://localhost:5173`
4. Ask a support question in the chat UI
5. Watch the streamed answer and returned source documents
6. Review live metrics and analytics in the dashboard
7. Upload a PDF from the Knowledge Base card to extend the retriever with new content

**Example support questions**

- `How do I invite team members?`
- `My notifications are not working`
- `What are the pricing plans?`

**Example PDF demo question**

- `What should I do for error FD-910 during file sync?`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check and model readiness |
| POST | `/chat` | Run the support pipeline and stream the answer |
| POST | `/feedback` | Store positive or negative user feedback |
| GET | `/metrics` | Return support metrics summary |
| GET | `/analytics` | Return detailed analytics data |
| POST | `/upload` | Upload a PDF, store it in GCS, and ingest it into the RAG system |

**Example health check**

```bash
curl http://localhost:8080/health
```

**Example upload**

```bash
curl -X POST http://localhost:8080/upload ^
  -F "file=@knowledge_base/test-upload-flowdesk.pdf"
```

---

## Knowledge Base and RAG

The default markdown sources used by the RAG system are:

- `knowledge_base/documents/billing.md`
- `knowledge_base/documents/faq.md`
- `knowledge_base/documents/technical.md`

### Full RAG Pipeline

The Flowdesk Support Agent uses a hybrid retrieval pipeline rather than relying on a single vector search. This improves recall for both natural-language support questions and keyword-heavy queries such as plan names, invoice terms, and error codes.

**1. Source documents**

The knowledge base starts from curated support documents in markdown:

- `billing.md`
- `faq.md`
- `technical.md`

It can also ingest uploaded PDFs through the website.

**2. Document ingestion**

For markdown ingestion, the system:

- loads all `.md` files from `knowledge_base/documents`
- splits first by markdown headers using `MarkdownHeaderTextSplitter`
- further splits large sections using `RecursiveCharacterTextSplitter`
- preserves metadata such as:
  - `source`
  - `header`
  - `chunk_index`

This gives semantically meaningful chunks instead of arbitrary text slices.

**3. Embedding generation**

Each chunk is embedded using:

- `BAAI/bge-small-en-v1.5`

These embeddings are normalized and stored in Pinecone for dense semantic retrieval.

**4. Pinecone vector storage**

Each chunk is uploaded to Pinecone with metadata including:

- source document name
- chunk index
- chunk text
- header path

This allows the retriever to later fetch semantically similar chunks and still preserve document/source context for grounded answers.

**5. Local BM25 chunk store**

At ingestion time, chunks are also saved into:

- `knowledge_base/chunks.json`

This local chunk file is used to build a BM25 keyword index. That gives the system sparse lexical retrieval to complement dense semantic retrieval.

**6. Query rewriting**

Before retrieval, the raw user query is rewritten by Groq into a more retrieval-friendly version.

This rewrite step is designed to:

- keep important action verbs like `invite`, `delete`, `cancel`, `export`
- preserve support terminology
- make vague user questions more searchable

Example benefit:

- `it's not working`

can become a more specific retrieval query while still keeping the original intent.

**7. Hybrid retrieval**

The retriever uses a hybrid strategy:

- dense search in Pinecone using embeddings
- BM25 sparse search over `chunks.json`

It actually runs dense retrieval twice:

- once on the rewritten query
- once on the original query

Then it merges those results before combining them with BM25 results.

This hybrid approach helps because:

- dense search is strong for semantic similarity and paraphrased questions
- BM25 is strong for exact phrases, short terms, product labels, and error codes

That combination is especially useful in support systems where users ask both:

- natural questions like `how do I invite someone to my workspace`
- exact-match questions like `FD-910` or `download PDF invoice`

**8. Result merging and deduplication**

Dense and BM25 candidates are merged and deduplicated by chunk id so the same chunk is not scored multiple times downstream.

The billing and technical agents can also apply source-aware prioritization so matching source documents are moved to the front before reranking.

**9. CrossEncoder reranking**

After retrieval, the candidate chunks are reranked with:

- `cross-encoder/ms-marco-MiniLM-L-6-v2`

This is different from vector similarity. Instead of comparing embeddings independently, the CrossEncoder scores the query and candidate chunk together, which usually gives better precision on the final top chunks.

This means:

- Pinecone + BM25 maximize recall
- CrossEncoder improves precision

**10. Contextual compression**

The top reranked chunks are then compressed using the LLM.

Instead of sending the whole chunk to the agent, the system extracts only the sentences that directly help answer the user’s question. This reduces prompt noise and helps keep answers focused and grounded.

Compression rules are strict:

- keep only relevant sentences
- preserve numbers, steps, and error codes
- return `EMPTY` if no useful text is found

**11. Specialist agent response generation**

The final compressed chunks are passed to the appropriate specialist agent:

- FAQ
- Technical
- Billing

That agent produces:

- the final answer
- confidence score
- issue type
- source docs used
- action taken (`send` or `escalate`)

**12. Evaluation and retry**

The evaluator checks the confidence and action from the specialist agent.

If confidence is too low:

- the system retries up to `MAX_RETRIES`
- if still weak, it escalates to the escalation agent

This adds a safety layer so unsupported or risky questions do not get overconfident answers.

### Why The Hybrid Setup Matters

The RAG system is intentionally hybrid because support queries are mixed in nature.

Dense retrieval helps with:

- paraphrases
- conversational questions
- fuzzy wording

BM25 helps with:

- exact feature names
- pricing terms
- plan labels
- error codes
- invoice terminology

CrossEncoder reranking helps with:

- selecting the best chunks from a noisy candidate pool

Contextual compression helps with:

- removing irrelevant chunk text before answer generation

Together, this creates a stronger support retriever than using Pinecone alone.

### PDF Upload Path

Uploaded PDFs follow a separate ingestion path:

1. file is uploaded through the frontend
2. backend stores the PDF in Google Cloud Storage
3. text is extracted with `pypdf`
4. text is chunked with `RecursiveCharacterTextSplitter`
5. chunks are embedded and upserted to Pinecone
6. chunk records are appended to `knowledge_base/chunks.json`
7. BM25 is refreshed in memory so the uploaded PDF becomes searchable immediately

Uploaded PDFs are:

- stored permanently in Google Cloud Storage
- embedded and stored permanently in Pinecone
- appended into `chunks.json` for BM25 on the current running instance

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PINECONE_API_KEY` | Yes | Pinecone API key |
| `PINECONE_INDEX_NAME` | Yes | Pinecone index name |
| `GROQ_API_KEY` | Yes | Groq key for LLM-powered retrieval steps |
| `GEMINI_API_KEY` | Yes | Gemini key used by the supervisor router |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `LANGCHAIN_API_KEY` | Optional | LangSmith tracing key |
| `LANGCHAIN_TRACING_V2` | Optional | Enables LangSmith tracing |
| `LANGCHAIN_PROJECT` | Optional | LangSmith project name |
| `GCS_BUCKET_NAME` | Required for PDF upload | Cloud Storage bucket for uploaded documents |
| `GOOGLE_APPLICATION_CREDENTIALS` | Required for local PDF upload | Path to GCP service account JSON |

---

## Deployment Notes

- The backend is containerized with Docker and deploys cleanly to Cloud Run
- The frontend can run locally with Vite or be hosted separately
- PDFs stored in GCS are permanent
- Pinecone vectors are permanent
- `chunks.json` used for BM25 is currently instance-local on Cloud Run, so PDF uploads are strongest immediately after ingestion on that running instance

---

## Notes

- The PDF upload flow is best for demos and live ingestion scenarios
- For the strongest retrieval, upload a PDF and ask a question from it right after ingestion
- Dense retrieval from Pinecone remains available even if BM25 state is later lost on Cloud Run restart
- Never commit `.env` or service account JSON files to GitHub

- - -
