"""
LangGraph orchestration for Flowdesk Support Agent.

Flow:
  START → supervisor_node → [faq|technical|billing|escalation]_node
        → evaluator_node → END  (or retry_node → specialist → evaluator_node)
"""

import os
from typing import Optional
from typing_extensions import TypedDict

from langgraph.graph import StateGraph, START, END

from memory.checkpointer import get_checkpointer
from agents.supervisor import SupervisorAgent
from agents.faq_agent import FAQAgent
from agents.technical_agent import TechnicalAgent
from agents.billing_agent import BillingAgent
from agents.escalation_agent import EscalationAgent
from evaluation.metrics_store import store_metric
from config import MAX_RETRIES, LANGCHAIN_API_KEY, LANGCHAIN_PROJECT
from utils.logger import get_logger

# LangSmith tracing
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = LANGCHAIN_API_KEY or ""
os.environ["LANGCHAIN_PROJECT"] = LANGCHAIN_PROJECT or "flowdesk-support-agent"

console = get_logger()


# ---------------------------------------------------------------------------
# Part 1 — State Definition
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    user_message: str           # original user message
    conversation_history: list  # past messages in the session
    intent: Optional[str]       # classification from supervisor
    response: Optional[dict]    # structured output from specialist agent
    retry_count: int            # number of retries attempted so far
    final_response: Optional[dict]  # the final output sent to user
    escalated: bool             # True when escalation has been finalized


# ---------------------------------------------------------------------------
# Part 2 — Agent Instances (initialized once at module level)
# ---------------------------------------------------------------------------

console.print("Initializing all agents...", style="bold cyan")
supervisor = SupervisorAgent()
faq = FAQAgent()
technical = TechnicalAgent()
billing = BillingAgent()
escalation = EscalationAgent()
console.print("[bold green]All agents ready.[/bold green]")


# ---------------------------------------------------------------------------
# Part 3 — Node Functions
# ---------------------------------------------------------------------------

def supervisor_node(state: AgentState) -> dict:
    """Classify user message into an intent category."""
    intent = supervisor.classify(state["user_message"])
    return {"intent": intent}


def faq_node(state: AgentState) -> dict:
    """Handle FAQ intent with RAG retrieval."""
    result = faq.handle(state["user_message"], state["conversation_history"])
    return {"response": result}


def technical_node(state: AgentState) -> dict:
    """Handle TECHNICAL intent with RAG retrieval."""
    result = technical.handle(state["user_message"], state["conversation_history"])
    return {"response": result}


def billing_node(state: AgentState) -> dict:
    """Handle BILLING intent with RAG retrieval."""
    result = billing.handle(state["user_message"], state["conversation_history"])
    return {"response": result}


def escalation_node(state: AgentState) -> dict:
    """Handle ESCALATE intent — no LLM call, fixed response."""
    result = escalation.handle(
        state["user_message"],
        reason="Classified as escalation by supervisor",
    )
    return {"response": result, "final_response": result}


def evaluator_node(state: AgentState) -> dict:
    """Evaluate specialist response — decide to send, escalate, or retry."""
    response = state["response"]
    retry_count = state["retry_count"]

    console.print(
        f"Evaluator — confidence: [bold]{response['confidence']:.2f}[/bold]  "
        f"action: [bold]{response['action_taken']}[/bold]  "
        f"retries: {retry_count}/{MAX_RETRIES}"
    )

    if response["action_taken"] == "escalate" and retry_count >= MAX_RETRIES:
        # Out of retries — hand off to escalation
        escalation_result = escalation.handle(
            state["user_message"],
            reason=f"Low confidence after {retry_count} retries",
        )
        return {"final_response": escalation_result, "escalated": True}

    if response["action_taken"] == "escalate" and retry_count < MAX_RETRIES:
        console.print(f"Low confidence — triggering retry {retry_count + 1}/{MAX_RETRIES}", style="bold red")
        return {
            "retry_count": retry_count + 1,
            "response": state["response"],
        }

    # action_taken == "send"
    return {"final_response": response}


def retry_node(state: AgentState) -> dict:
    """Log retry attempt and preserve intent/retry_count in state."""
    if state.get("escalated", False):
        console.print("retry_node: escalation already finalized — stopping", style="bold red")
        return {"escalated": True}
    retry_count = state["retry_count"]
    intent = state["intent"]
    console.print(f"Retrying — attempt {retry_count} — intent: {intent}", style="bold yellow")
    return {"intent": intent, "retry_count": retry_count}


# ---------------------------------------------------------------------------
# Part 4 — Routing Functions
# ---------------------------------------------------------------------------

def route_by_intent(state: AgentState) -> str:
    """Route to the appropriate specialist node based on supervisor intent."""
    return {
        "FAQ": "faq_node",
        "TECHNICAL": "technical_node",
        "BILLING": "billing_node",
        "ESCALATE": "escalation_node",
    }.get(state["intent"], "escalation_node")


def route_after_evaluation(state: AgentState) -> str:
    """After evaluation, decide whether to end or retry."""
    if state.get("escalated", False):
        return "__end__"

    response = state.get("response")
    retry_count = state.get("retry_count", 0)

    if response is None:
        return "__end__"

    if response["action_taken"] == "send":
        return "__end__"

    if response["action_taken"] == "escalate":
        if retry_count > MAX_RETRIES:
            return "__end__"
        else:
            return "retry_node"

    return "__end__"


def route_retry(state: AgentState) -> str:
    """Route retry back to the same specialist as the original intent."""
    if state.get("escalated", False):
        return "__end__"
    intent = state.get("intent", "ESCALATE")
    console.print(f"Route retry — intent: {intent}", style="dim")
    mapping = {
        "FAQ": "faq_node",
        "TECHNICAL": "technical_node",
        "BILLING": "billing_node",
        "ESCALATE": "escalation_node",
    }
    return mapping.get(intent, "escalation_node")


# ---------------------------------------------------------------------------
# Part 5 — Build The Graph
# ---------------------------------------------------------------------------

graph = StateGraph(AgentState)

graph.add_node("supervisor_node", supervisor_node)
graph.add_node("faq_node", faq_node)
graph.add_node("technical_node", technical_node)
graph.add_node("billing_node", billing_node)
graph.add_node("escalation_node", escalation_node)
graph.add_node("evaluator_node", evaluator_node)
graph.add_node("retry_node", retry_node)

graph.add_edge(START, "supervisor_node")
graph.add_conditional_edges("supervisor_node", route_by_intent)
graph.add_edge("faq_node", "evaluator_node")
graph.add_edge("technical_node", "evaluator_node")
graph.add_edge("billing_node", "evaluator_node")
graph.add_edge("escalation_node", END)
graph.add_conditional_edges("evaluator_node", route_after_evaluation)
graph.add_conditional_edges("retry_node", route_retry)

checkpointer = get_checkpointer()
app = graph.compile(checkpointer=checkpointer)


# ---------------------------------------------------------------------------
# Part 6 — Run Function
# ---------------------------------------------------------------------------

def run_support_agent(
    user_message: str,
    conversation_history: list = [],
    session_id: str = "default",
) -> dict:
    """Entry point: run the full multi-agent pipeline for a user message."""
    console.rule("[bold blue]Flowdesk Support Agent[/bold blue]")

    config = {"configurable": {"thread_id": session_id}}

    # Load existing conversation history from checkpoint if available
    existing_state = app.get_state(config)
    if existing_state and existing_state.values.get("conversation_history"):
        conversation_history = existing_state.values["conversation_history"]

    initial_state: AgentState = {
        "user_message": user_message,
        "conversation_history": conversation_history,
        "intent": None,
        "response": None,
        "retry_count": 0,
        "final_response": None,
        "escalated": False,
    }

    result = app.invoke(initial_state, config=config)

    console.rule("[bold blue]Done[/bold blue]")

    if result.get("final_response") is None:
        console.print("Graph completed without final_response — returning escalation fallback", style="yellow")
        return {
            "answer": "Thank you for reaching out. Your query has been escalated to our support team. A human agent will follow up within 24 hours.",
            "confidence": 0.0,
            "source_docs": [],
            "issue_type": "escalation",
            "action_taken": "escalate",
            "retrieved_chunks": 0,
        }

    final_response = result["final_response"]

    # Append this exchange to conversation history in state
    new_exchange = {"role": "user", "content": user_message}
    assistant_exchange = {"role": "assistant", "content": final_response["answer"]}
    updated_history = conversation_history + [new_exchange, assistant_exchange]

    # Persist updated history back into the checkpoint
    app.update_state(config, {"conversation_history": updated_history})

    # Store metrics — wrapped in try/except so a failure never crashes the main flow
    try:
        store_metric(
            session_id=session_id,
            user_message=user_message,
            intent=result.get("intent", "unknown"),
            confidence=final_response.get("confidence", 0.0),
            action_taken=final_response.get("action_taken", "unknown"),
            chunks_retrieved=final_response.get("retrieved_chunks", 0),
            issue_type=final_response.get("issue_type", "unknown"),
            retry_count=result.get("retry_count", 0),
        )
    except Exception as e:
        console.print(f"Metrics storage failed (non-critical): {e}", style="dim yellow")

    return final_response


# ---------------------------------------------------------------------------
# Part 7 — Test Block
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    session_id = "test-session-001"

    # Simulate a multi-turn conversation
    messages = [
        "my notifications are not working",
        "I already checked my settings, still not working",
        "what error codes should I look for",
    ]

    for message in messages:
        print(f"\nUser: {message}")
        result = run_support_agent(message, session_id=session_id)
        print(f"Agent: {result['answer'][:200]}...")
        print(f"Confidence: {result['confidence']}")
        print(f"Action: {result['action_taken']}")
