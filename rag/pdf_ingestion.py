import json
import os
import sys
from pathlib import Path

from google.cloud import storage
from pinecone import Pinecone
from pypdf import PdfReader
from rank_bm25 import BM25Okapi
from langchain_text_splitters import RecursiveCharacterTextSplitter

import config as app_config
from config import CHUNK_OVERLAP, CHUNK_SIZE, PINECONE_API_KEY, PINECONE_INDEX_NAME
from rag.embeddings import get_embeddings
from utils.logger import get_logger

console = get_logger()

GCS_BUCKET_NAME = getattr(app_config, "GCS_BUCKET_NAME", os.getenv("GCS_BUCKET_NAME"))
CHUNKS_PATH = Path("knowledge_base/chunks.json")


def upload_to_gcs(file_path: str, filename: str) -> str:
    client = storage.Client()
    bucket = client.bucket(GCS_BUCKET_NAME)
    blob = bucket.blob(f"documents/{filename}")
    blob.upload_from_filename(file_path)

    gcs_uri = f"gs://{GCS_BUCKET_NAME}/documents/{filename}"
    console.print(f"Uploaded [bold]{filename}[/bold] to [cyan]{gcs_uri}[/cyan]")
    return gcs_uri


def extract_text_from_pdf(file_path: str) -> str:
    reader = PdfReader(file_path)
    console.print(f"Extracting text from [bold]{len(reader.pages)}[/bold] PDF page(s)")
    pages = [(page.extract_text() or "").strip() for page in reader.pages]
    return "\n\n".join(page for page in pages if page)


def refresh_bm25_index() -> None:
    retriever = sys.modules.get("rag.retriever")
    if retriever is None:
        return

    with open(CHUNKS_PATH, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    retriever._chunks = chunks
    retriever._bm25_corpus = [chunk["text"].lower().split() for chunk in chunks]
    retriever._bm25 = BM25Okapi(retriever._bm25_corpus)
    console.print("BM25 index refreshed", style="bold green")


def ingest_pdf(file_path: str, filename: str) -> dict:
    try:
        gcs_uri = upload_to_gcs(file_path, filename)
        text = extract_text_from_pdf(file_path)

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
        )
        texts = splitter.split_text(text)
        embeddings = get_embeddings(texts)

        pc = Pinecone(api_key=PINECONE_API_KEY)
        index = pc.Index(PINECONE_INDEX_NAME)

        vectors = []
        new_chunks = []
        for i, (chunk_text, embedding) in enumerate(zip(texts, embeddings)):
            metadata = {
                "source": filename,
                "chunk_index": i,
                "page_content": chunk_text,
                "header": "PDF > Uploaded Document",
            }
            vectors.append(
                {
                    "id": f"{filename}_{i}",
                    "values": embedding,
                    "metadata": metadata,
                }
            )
            new_chunks.append(
                {
                    "id": f"{filename}_{i}",
                    "text": chunk_text,
                    "source": filename,
                    "header": "PDF > Uploaded Document",
                    "chunk_index": i,
                }
            )

        if vectors:
            index.upsert(vectors=vectors)

        existing_chunks = []
        if CHUNKS_PATH.exists():
            with open(CHUNKS_PATH, "r", encoding="utf-8") as f:
                existing_chunks = json.load(f)

        existing_chunks.extend(new_chunks)
        CHUNKS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CHUNKS_PATH, "w", encoding="utf-8") as f:
            json.dump(existing_chunks, f, indent=2, ensure_ascii=False)

        refresh_bm25_index()

        return {
            "filename": filename,
            "chunks_created": len(new_chunks),
            "gcs_uri": gcs_uri,
            "status": "success",
        }
    except Exception as e:
        console.print(f"PDF ingestion failed: {e}", style="bold red")
        return {
            "filename": filename,
            "chunks_created": 0,
            "gcs_uri": "",
            "status": "error",
            "error": str(e),
        }
