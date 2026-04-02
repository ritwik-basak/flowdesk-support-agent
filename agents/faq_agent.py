"""
FAQAgent — handles general how-to and feature questions using RAG retrieval.
Retrieves from all knowledge base documents (no source filter).
"""

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from config import GROQ_API_KEY, GROQ_MODEL, FAQ_CONFIDENCE_THRESHOLD
from rag.retriever import retrieve
from utils.logger import get_logger

console = get_logger()

_SYSTEM_PROMPT = (
    "You are a helpful FAQ assistant for Flowdesk, a project management SaaS. "
    "Answer questions using only the provided context. "
    "Give clear numbered steps when explaining processes. "
    "Be concise and friendly. "
    "If the context does not contain enough information to answer confidently, say so honestly."
)

_LOW_CONFIDENCE_PHRASES = [
    "i don't know",
    "not sure",
    "cannot find",
    "i don't have enough information",
    "does not contain",
    "only covers",
    "context only covers",
    "not mention",
    "no information",
    "unable to find",
]


class FAQAgent:
    def __init__(self):
        console.print("Initializing FAQAgent (Groq)...", style="bold cyan")
        self._llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL)
        console.print("[bold green]FAQAgent ready.[/bold green]")

    def handle(self, user_message: str, conversation_history: list) -> dict:
        """Retrieve context and generate a FAQ answer."""
        console.print(f"\n[bold blue]FAQAgent handling:[/bold blue] {user_message[:80]}")

        # Step 1 — Retrieve (no source filter: search all documents)
        console.print("Retrieving context...")
        chunks = retrieve(user_message)

        if not chunks:
            console.print("[yellow]No chunks retrieved — escalating.[/yellow]")
            return {
                "answer": "I wasn't able to find relevant information for your question.",
                "confidence": 0.0,
                "source_docs": [],
                "issue_type": "faq",
                "action_taken": "escalate",
                "retrieved_chunks": 0,
            }

        # Step 2 — Build prompt and generate answer
        context_text = ""
        for chunk in chunks:
            context_text += (
                f"[source: {chunk['source']}, section: {chunk['header']}]\n"
                f"{chunk['text']}\n\n"
            )

        # Include last 3 messages from conversation history for continuity
        history_text = ""
        for msg in conversation_history[-3:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            history_text += f"{role.capitalize()}: {content}\n"

        user_prompt = (
            f"Context:\n{context_text}"
            f"{'Conversation history:' + chr(10) + history_text if history_text else ''}"
            f"User: {user_message}"
        )

        console.print("Generating answer...")
        response = self._llm.invoke([
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ])
        answer = response.content.strip()

        # Step 3 — Score confidence
        confidence = 0.7
        if len(chunks) >= 3:
            confidence += 0.1
        if len(chunks) == 1:
            confidence -= 0.1
        answer_lower = answer.lower()
        if any(phrase in answer_lower for phrase in _LOW_CONFIDENCE_PHRASES):
            confidence -= 0.2
        confidence = max(0.0, min(1.0, confidence))

        # Step 4 — Return structured output
        action = "send" if confidence >= FAQ_CONFIDENCE_THRESHOLD else "escalate"
        source_docs = [{"source": c["source"], "header": c["header"]} for c in chunks]

        console.print(
            f"FAQAgent done — confidence: [bold]{confidence:.2f}[/bold], action: [bold]{action}[/bold]"
        )
        return {
            "answer": answer,
            "confidence": confidence,
            "source_docs": source_docs,
            "issue_type": "faq",
            "action_taken": action,
            "retrieved_chunks": len(chunks),
        }
