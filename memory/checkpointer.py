"""
PostgreSQL checkpointer for LangGraph conversation persistence.
Allows conversations to resume across multiple messages using thread_id.
"""

import psycopg
from langgraph.checkpoint.postgres import PostgresSaver
from config import DATABASE_URL
from utils.logger import get_logger

console = get_logger()


def get_checkpointer() -> PostgresSaver:
    """Connect to PostgreSQL and return a LangGraph checkpointer."""
    conn = psycopg.connect(DATABASE_URL, autocommit=True)
    checkpointer = PostgresSaver(conn)
    console.print("Checkpointer connected to PostgreSQL", style="bold green")
    return checkpointer


def setup_checkpointer() -> PostgresSaver:
    """Create the required LangGraph checkpoint tables in PostgreSQL."""
    checkpointer = get_checkpointer()
    checkpointer.setup()
    console.print("Checkpointer tables created successfully", style="bold green")
    return checkpointer
