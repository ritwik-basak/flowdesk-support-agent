"""
Feedback storage for Flowdesk Support Agent.
Stores user thumbs-up/thumbs-down feedback per session and query.
"""

from database.connection import get_connection
from utils.logger import get_logger

console = get_logger()


def store_feedback(
    session_id: str,
    user_message: str,
    agent_answer: str,
    feedback_type: str,
) -> bool:
    """Insert a feedback row. feedback_type must be 'positive' or 'negative'."""
    if feedback_type not in ("positive", "negative"):
        console.print(
            f"Invalid feedback_type '{feedback_type}' — must be 'positive' or 'negative'",
            style="bold red",
        )
        return False

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO feedback (session_id, user_message, agent_answer, feedback_type)
            VALUES (%s, %s, %s, %s)
            """,
            (session_id, user_message, agent_answer, feedback_type),
        )
        conn.commit()
        cursor.close()
        conn.close()
        console.print(
            f"Feedback stored: [bold]{feedback_type}[/bold] for session [bold]{session_id}[/bold]"
        )
        return True
    except Exception as e:
        console.print(f"Failed to store feedback: {e}", style="bold red")
        return False


def get_feedback_summary() -> dict:
    """Return aggregated feedback counts and positive rate."""
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM feedback")
        total = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM feedback WHERE feedback_type = 'positive'")
        positive = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM feedback WHERE feedback_type = 'negative'")
        negative = cursor.fetchone()[0]

        cursor.close()
        conn.close()

        positive_rate = round((positive / total * 100), 2) if total > 0 else 0.0

        return {
            "total_feedback": total,
            "positive": positive,
            "negative": negative,
            "positive_rate": positive_rate,
        }
    except Exception as e:
        console.print(f"Failed to get feedback summary: {e}", style="bold red")
        return {}


# ---------------------------------------------------------------------------
# Test block
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from database.connection import setup_tables

    setup_tables()

    store_feedback(
        session_id="test-session-001",
        user_message="my notifications are not working",
        agent_answer="Here are the troubleshooting steps...",
        feedback_type="positive",
    )
    store_feedback(
        session_id="test-session-001",
        user_message="how do I invite someone",
        agent_answer="Follow these steps...",
        feedback_type="negative",
    )

    summary = get_feedback_summary()
    print(f"Feedback summary: {summary}")
