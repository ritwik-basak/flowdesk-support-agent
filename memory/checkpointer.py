"""
Conversation checkpointing for LangGraph.

Defaults to in-memory checkpointing for reliability in ephemeral environments
like Cloud Run. PostgreSQL checkpointing can still be enabled explicitly.
"""

import os

import psycopg
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.postgres import PostgresSaver

from config import DATABASE_URL
from utils.logger import get_logger

console = get_logger()
USE_POSTGRES_CHECKPOINTER = os.getenv("USE_POSTGRES_CHECKPOINTER", "false").lower() == "true"


def get_checkpointer():
    """Return the configured checkpointer implementation."""
    if USE_POSTGRES_CHECKPOINTER and DATABASE_URL:
        try:
            conn = psycopg.connect(DATABASE_URL, autocommit=True)
            checkpointer = PostgresSaver(conn)
            console.print("Checkpointer connected to PostgreSQL", style="bold green")
            return checkpointer
        except Exception as e:
            console.print(f"PostgreSQL checkpointer unavailable, falling back to memory: {e}", style="yellow")

    console.print("Using in-memory checkpointer", style="bold yellow")
    return MemorySaver()


def setup_checkpointer():
    """Create PostgreSQL checkpoint tables when that backend is enabled."""
    if not USE_POSTGRES_CHECKPOINTER or not DATABASE_URL:
        console.print("Skipping checkpoint table setup because memory checkpointing is enabled", style="yellow")
        return MemorySaver()

    checkpointer = get_checkpointer()
    if isinstance(checkpointer, PostgresSaver):
        checkpointer.setup()
        console.print("Checkpointer tables created successfully", style="bold green")
    return checkpointer
