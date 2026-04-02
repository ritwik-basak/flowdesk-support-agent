import json
import os
from pathlib import Path

from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)
from pinecone import Pinecone

from config import (
    PINECONE_API_KEY,
    PINECONE_INDEX_NAME,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
)
from rag.embeddings import get_embeddings
from utils.logger import get_logger

console = get_logger()

DOCUMENTS_DIR = Path("knowledge_base/documents")
CHUNKS_PATH = Path("knowledge_base/chunks.json")

MARKDOWN_HEADERS = [
    ("#", "H1"),
    ("##", "H2"),
    ("###", "H3"),
]


def load_documents():
    docs = []
    for md_file in DOCUMENTS_DIR.glob("*.md"):
        loader = TextLoader(str(md_file), encoding="utf-8")
        loaded = loader.load()
        for doc in loaded:
            doc.metadata["source"] = md_file.name
        docs.extend(loaded)
    console.print(f"Loaded [bold]{len(docs)}[/bold] document(s).")
    return docs


def chunk_documents(docs):
    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=MARKDOWN_HEADERS,
        strip_headers=False,
    )
    char_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )

    all_chunks = []
    for doc in docs:
        source = doc.metadata.get("source", "unknown")

        # Stage 1: split by markdown headers
        header_chunks = header_splitter.split_text(doc.page_content)
        for hchunk in header_chunks:
            hchunk.metadata["source"] = source
            header_text = " > ".join(
                v for k, v in hchunk.metadata.items() if k.startswith("H")
            )
            hchunk.metadata["header"] = header_text or ""

        # Stage 2: further split chunks that exceed CHUNK_SIZE
        for hchunk in header_chunks:
            if len(hchunk.page_content) > CHUNK_SIZE:
                sub_chunks = char_splitter.split_documents([hchunk])
                all_chunks.extend(sub_chunks)
            else:
                all_chunks.append(hchunk)

    # Assign sequential chunk_index across all chunks
    for i, chunk in enumerate(all_chunks):
        chunk.metadata["chunk_index"] = i

    console.print(f"Created [bold]{len(all_chunks)}[/bold] chunks after splitting.")
    return all_chunks


def embed_chunks(chunks):
    texts = [chunk.page_content for chunk in chunks]
    console.print(f"Embedding [bold]{len(texts)}[/bold] chunks...")
    return get_embeddings(texts)


def upload_to_pinecone(chunks, embeddings):
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(PINECONE_INDEX_NAME)

    batch_size = 50
    total = len(chunks)

    for batch_start in range(0, total, batch_size):
        batch_chunks = chunks[batch_start : batch_start + batch_size]
        batch_embeddings = embeddings[batch_start : batch_start + batch_size]

        vectors = []
        for chunk, embedding in zip(batch_chunks, batch_embeddings):
            meta = chunk.metadata.copy()
            meta["page_content"] = chunk.page_content
            source = meta.get("source", "unknown")
            chunk_index = meta.get("chunk_index", batch_start)
            vector_id = f"{source}_{chunk_index}"
            vectors.append({"id": vector_id, "values": embedding, "metadata": meta})

        index.upsert(vectors=vectors)
        batch_end = min(batch_start + batch_size, total)
        console.print(
            f"Uploaded batch [bold]{batch_start + 1}–{batch_end}[/bold] / {total}"
        )

    console.print("[bold green]Pinecone upload complete[/bold green]")


def save_chunks_locally(chunks):
    records = []
    for chunk in chunks:
        meta = chunk.metadata
        records.append(
            {
                "id": f"{meta.get('source', 'unknown')}_{meta.get('chunk_index', 0)}",
                "text": chunk.page_content,
                "source": meta.get("source", "unknown"),
                "header": meta.get("header", ""),
                "chunk_index": meta.get("chunk_index", 0),
            }
        )

    CHUNKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CHUNKS_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)

    console.print(f"Chunks saved to [bold]{CHUNKS_PATH}[/bold]")


if __name__ == "__main__":
    docs = load_documents()
    chunks = chunk_documents(docs)
    embeddings = embed_chunks(chunks)
    upload_to_pinecone(chunks, embeddings)
    save_chunks_locally(chunks)
