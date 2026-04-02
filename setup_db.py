from memory.checkpointer import setup_checkpointer
from database.connection import setup_tables

if __name__ == "__main__":
    setup_checkpointer()
    setup_tables()
    print("Full database setup complete")
