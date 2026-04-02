"""
BillingAgent — handles payment, subscription, pricing, and refund questions.
Retrieves with source_filter="billing.md" to prioritise billing documentation.
Applies an extra confidence penalty for vague/approximate billing answers.
"""

import json
from pathlib import Path

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from config import GROQ_API_KEY, GROQ_MODEL, BILLING_CONFIDENCE_THRESHOLD
from rag.retriever import retrieve
from utils.logger import get_logger

console = get_logger()

_SYSTEM_PROMPT = (
    "You are a billing specialist for Flowdesk, a project management SaaS. "
    "Help users with payment, subscription, and billing questions using only the provided context. "
    "Always be empathetic — billing issues cause stress. "
    "Always mention refund policies when relevant. "
    "Never guess at pricing — only state what is in the context."
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
_VAGUE_BILLING_PHRASES = ["approximately", "around", "roughly"]


class BillingAgent:
    def __init__(self):
        console.print("Initializing BillingAgent (Groq)...", style="bold cyan")
        self._llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL)
        console.print("[bold green]BillingAgent ready.[/bold green]")

    def handle(self, user_message: str, conversation_history: list) -> dict:
        """Retrieve billing context and generate a precise billing answer."""
        console.print(f"\n[bold blue]BillingAgent handling:[/bold blue] {user_message[:80]}")

        # Step 1 — Retrieve (prioritise billing.md)
        console.print("Retrieving billing context...")
        chunks = retrieve(user_message, source_filter="billing.md", skip_compression=True)

        # Inject pricing tier chunks for any pricing-related query
        _PRICING_KEYWORDS = ["cost", "price", "pricing", "plan", "how much", "subscription cost"]
        if any(kw in user_message.lower() for kw in _PRICING_KEYWORDS):
            console.print("Pricing query detected — injecting plan tier chunks", style="bold yellow")
            _TIER_IDS = {"billing.md_2", "billing.md_3", "billing.md_4"}
            existing_ids = {c["id"] for c in chunks}
            chunks_path = Path("knowledge_base/chunks.json")
            with open(chunks_path, "r", encoding="utf-8") as f:
                all_chunks = json.load(f)
            for chunk in all_chunks:
                if chunk["id"] in _TIER_IDS and chunk["id"] not in existing_ids:
                    chunks.append(chunk)
                    existing_ids.add(chunk["id"])

        if not chunks:
            console.print("[yellow]No chunks retrieved — escalating.[/yellow]")
            return {
                "answer": "I wasn't able to find relevant billing information for your question.",
                "confidence": 0.0,
                "source_docs": [],
                "issue_type": "billing",
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

        console.print("Generating billing answer...")
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
        # Billing-specific: penalise vague/approximate answers
        if any(phrase in answer_lower for phrase in _VAGUE_BILLING_PHRASES):
            confidence -= 0.15
        confidence = max(0.0, min(1.0, confidence))

        # Step 4 — Return structured output
        action = "send" if confidence >= BILLING_CONFIDENCE_THRESHOLD else "escalate"
        source_docs = [{"source": c["source"], "header": c["header"]} for c in chunks]

        console.print(
            f"BillingAgent done — confidence: [bold]{confidence:.2f}[/bold], action: [bold]{action}[/bold]"
        )
        return {
            "answer": answer,
            "confidence": confidence,
            "source_docs": source_docs,
            "issue_type": "billing",
            "action_taken": action,
            "retrieved_chunks": len(chunks),
        }
