# config will be populated as we add components
import os
from dotenv import load_dotenv

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

CHUNK_SIZE = 600
CHUNK_OVERLAP = 75

TOP_K_DENSE = 15
TOP_K_RERANKED = 5

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile"
LANGCHAIN_API_KEY = os.getenv("LANGCHAIN_API_KEY")
LANGCHAIN_PROJECT = os.getenv("LANGCHAIN_PROJECT")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"


# Each agent has its own confidence threshold
# Billing is highest — wrong financial info causes real disputes
# Technical is medium — wrong steps waste user time
# FAQ is lowest — low stakes, user can easily retry
FAQ_CONFIDENCE_THRESHOLD = 0.4
TECHNICAL_CONFIDENCE_THRESHOLD = 0.5
BILLING_CONFIDENCE_THRESHOLD = 0.55 #below this score → escalate


MAX_RETRIES = 1  # maximum retry attempts before forcing escalation

DATABASE_URL = os.getenv("DATABASE_URL")


GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")