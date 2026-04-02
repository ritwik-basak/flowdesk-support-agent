"""
Run during Docker build to pre-download HuggingFace models.
This avoids the 10-minute cold start on Cloud Run.
"""
from sentence_transformers import SentenceTransformer, CrossEncoder

print("Downloading embedding model: BAAI/bge-small-en-v1.5...")
SentenceTransformer("BAAI/bge-small-en-v1.5")
print("Embedding model downloaded.")

print("Downloading reranker model: cross-encoder/ms-marco-MiniLM-L-6-v2...")
CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
print("Reranker model downloaded.")

print("All models ready.")
