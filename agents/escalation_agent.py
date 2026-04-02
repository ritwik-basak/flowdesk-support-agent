"""
EscalationAgent — handles queries that cannot be resolved automatically.
Makes no LLM calls — returns a fixed escalation response immediately.
Triggered when: confidence is too low, no context found, or supervisor routes to ESCALATE.
"""

from utils.logger import get_logger

console = get_logger()

_ESCALATION_ANSWER = (
    "Thank you for reaching out to Flowdesk support. Your query has been flagged for review "
    "by our support team. A human agent will follow up with you within 24 hours. "
    "We apologize for any inconvenience."
)


class EscalationAgent:
    def handle(self, user_message: str, reason: str) -> dict:
        """Return a fixed escalation response without making any LLM call."""
        console.print(
            f"\n[bold red]EscalationAgent triggered.[/bold red] "
            f"Reason: [dim]{reason}[/dim]"
        )
        console.print(f"  User message: [dim]{user_message[:80]}[/dim]")

        return {
            "answer": _ESCALATION_ANSWER,
            "confidence": 0.0,
            "source_docs": [],
            "issue_type": "escalation",
            "action_taken": "escalate",
            "escalation_reason": reason,
            "retrieved_chunks": 0,
        }
