"""
Metrics storage and reporting for Flowdesk Support Agent.
Tracks per-query performance: confidence, intent, action, chunks retrieved.
"""

from database.connection import get_connection
from utils.logger import get_logger

console = get_logger()


def store_metric(
    session_id: str,
    user_message: str,
    intent: str,
    confidence: float,
    action_taken: str,
    chunks_retrieved: int,
    issue_type: str,
    retry_count: int,
) -> bool:
    """Insert a metrics row for a completed agent turn."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO metrics
                (session_id, user_message, intent, confidence, action_taken,
                 chunks_retrieved, issue_type, retry_count)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (session_id, user_message, intent, confidence, action_taken,
             chunks_retrieved, issue_type, retry_count),
        )
        conn.commit()
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        console.print(f"Failed to store metric: {e}", style="bold red")
        return False


def get_metrics_summary() -> dict:
    """Return aggregated metrics across all sessions."""
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM metrics")
        total = cursor.fetchone()[0]

        cursor.execute("SELECT AVG(confidence) FROM metrics")
        avg_conf_raw = cursor.fetchone()[0]
        avg_confidence = round(float(avg_conf_raw), 2) if avg_conf_raw else 0.0

        cursor.execute(
            "SELECT COUNT(*) FROM metrics WHERE action_taken = 'escalate'"
        )
        escalated = cursor.fetchone()[0]
        escalation_rate = round((escalated / total * 100), 2) if total > 0 else 0.0

        cursor.execute(
            "SELECT intent, COUNT(*) FROM metrics GROUP BY intent"
        )
        intent_breakdown = {row[0]: row[1] for row in cursor.fetchall()}

        cursor.execute("SELECT AVG(chunks_retrieved) FROM metrics")
        avg_chunks_raw = cursor.fetchone()[0]
        avg_chunks = round(float(avg_chunks_raw), 2) if avg_chunks_raw else 0.0

        cursor.execute(
            """
            SELECT user_message FROM metrics
            WHERE confidence < 0.5
            ORDER BY timestamp DESC
            LIMIT 5
            """
        )
        low_confidence_queries = [row[0] for row in cursor.fetchall()]

        cursor.close()
        conn.close()

        return {
            "total_queries": total,
            "avg_confidence": avg_confidence,
            "escalation_rate": escalation_rate,
            "intent_breakdown": intent_breakdown,
            "avg_chunks_retrieved": avg_chunks,
            "low_confidence_queries": low_confidence_queries,
        }
    except Exception as e:
        console.print(f"Failed to get metrics summary: {e}", style="bold red")
        return {}


def get_all_queries(limit: int = 200) -> list:
    """Return raw query logs for the analytics dashboard."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT session_id, user_message, intent, confidence, action_taken,
                   chunks_retrieved, issue_type, retry_count, timestamp
            FROM metrics
            ORDER BY timestamp DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return [
            {
                "session_id": row[0],
                "user_message": row[1],
                "intent": row[2],
                "confidence": round(float(row[3]), 2) if row[3] else 0,
                "action_taken": row[4],
                "chunks_retrieved": row[5],
                "issue_type": row[6],
                "retry_count": row[7],
                "timestamp": row[8].isoformat() if row[8] else None,
            }
            for row in rows
        ]
    except Exception as e:
        console.print(f"Failed to get all queries: {e}", style="bold red")
        return []


def get_session_summary() -> list:
    """Return per-session aggregated stats."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT session_id,
                   COUNT(*) as total_queries,
                   AVG(confidence) as avg_confidence,
                   SUM(CASE WHEN action_taken = 'escalate' THEN 1 ELSE 0 END) as escalations,
                   SUM(retry_count) as total_retries,
                   MIN(timestamp) as started_at,
                   MAX(timestamp) as last_activity
            FROM metrics
            GROUP BY session_id
            ORDER BY last_activity DESC
            LIMIT 50
            """,
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return [
            {
                "session_id": row[0],
                "total_queries": row[1],
                "avg_confidence": round(float(row[2]), 2) if row[2] else 0,
                "escalations": row[3],
                "total_retries": row[4],
                "started_at": row[5].isoformat() if row[5] else None,
                "last_activity": row[6].isoformat() if row[6] else None,
            }
            for row in rows
        ]
    except Exception as e:
        console.print(f"Failed to get session summary: {e}", style="bold red")
        return []


def get_top_failing_queries(limit: int = 5) -> list:
    """Return the most recent escalated queries with context."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT user_message, confidence, intent, timestamp
            FROM metrics
            WHERE action_taken = 'escalate'
            ORDER BY timestamp DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        return [
            {
                "user_message": row[0],
                "confidence": row[1],
                "intent": row[2],
                "timestamp": row[3],
            }
            for row in rows
        ]
    except Exception as e:
        console.print(f"Failed to get top failing queries: {e}", style="bold red")
        return []
