"""
PostgreSQL connection and table setup for feedback and metrics storage.
"""

import psycopg2
from config import DATABASE_URL
from utils.logger import get_logger

console = get_logger()


def get_connection():
    """Return a psycopg2 connection to PostgreSQL."""
    return psycopg2.connect(DATABASE_URL)


def setup_tables():
    """Create feedback and metrics tables if they don't already exist."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id SERIAL PRIMARY KEY,
            session_id VARCHAR(255) NOT NULL,
            user_message TEXT NOT NULL,
            agent_answer TEXT NOT NULL,
            feedback_type VARCHAR(50) NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS metrics (
            id SERIAL PRIMARY KEY,
            session_id VARCHAR(255) NOT NULL,
            user_message TEXT NOT NULL,
            intent VARCHAR(50),
            confidence FLOAT,
            action_taken VARCHAR(50),
            chunks_retrieved INTEGER,
            issue_type VARCHAR(50),
            retry_count INTEGER DEFAULT 0,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    conn.commit()
    cursor.close()
    conn.close()
    console.print("Database tables created successfully", style="bold green")
