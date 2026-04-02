"""
SupervisorAgent — classifies incoming user messages into one of four routing categories:
  FAQ | TECHNICAL | BILLING | ESCALATE
Uses Gemini as the classifier LLM.
"""

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

from config import GEMINI_API_KEY, GEMINI_MODEL
from utils.logger import get_logger

console = get_logger()

_SYSTEM_PROMPT = (
    "You are a customer support router for Flowdesk, a project management SaaS. "
    "Classify the user message into exactly one of these categories: FAQ, TECHNICAL, BILLING, ESCALATE. "
    "Rules: "
    "Choose FAQ for how-to questions, feature questions, and general usage questions. "
    "Choose TECHNICAL for bug reports, error codes, integration issues, and things not working. "
    "Choose BILLING for payment, pricing, subscription, refund, and plan questions. "
    "Choose ESCALATE for account deletion, legal requests, abusive messages, or anything you cannot confidently classify. "
    "Return only the category word, nothing else."
)

_VALID_CATEGORIES = {"FAQ", "TECHNICAL", "BILLING", "ESCALATE"}


class SupervisorAgent:
    def __init__(self):
        console.print("Initializing SupervisorAgent (Gemini)...", style="bold cyan")
        self._llm = ChatGoogleGenerativeAI(
            google_api_key=GEMINI_API_KEY,
            model=GEMINI_MODEL,
        )
        console.print("[bold green]SupervisorAgent ready.[/bold green]")

    def classify(self, user_message: str) -> str:
        """Classify user message into FAQ, TECHNICAL, BILLING, or ESCALATE."""
        console.print(f"Supervisor classifying: [dim]{user_message[:80]}[/dim]")

        messages = [
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=user_message),
        ]
        response = self._llm.invoke(messages)
        category = response.content.strip().upper()

        # Fallback to ESCALATE if Gemini returns something unexpected
        if category not in _VALID_CATEGORIES:
            console.print(
                f"Unexpected classification '[bold]{category}[/bold]', defaulting to ESCALATE",
                style="yellow"
            )
            category = "ESCALATE"

        console.print(f"Classification: [bold magenta]{category}[/bold magenta]")
        return category
