"""
RAG Retrieval Pipeline for Flowdesk Support Agent.

Pipeline order:
  rewrite_query → dense_search → bm25_search → merge_results → rerank → compress_chunks
"""

import json
from pathlib import Path

from pinecone import Pinecone
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from config import (
    PINECONE_API_KEY,
    PINECONE_INDEX_NAME,
    RERANKER_MODEL,
    TOP_K_DENSE,
    TOP_K_RERANKED,
    GROQ_API_KEY,
    GROQ_MODEL,
)
from rag.embeddings import get_single_embedding
from utils.logger import get_logger

console = get_logger()

# ---------------------------------------------------------------------------
# Part 1 — Module-level initialization
# ---------------------------------------------------------------------------

# Pinecone
console.print("Connecting to Pinecone...", style="bold cyan")
_pc = Pinecone(api_key=PINECONE_API_KEY)
_index = _pc.Index(PINECONE_INDEX_NAME)

# Load chunks.json into memory for BM25
_CHUNKS_PATH = Path("knowledge_base/chunks.json")
console.print(f"Loading chunks from [bold]{_CHUNKS_PATH}[/bold]...")
with open(_CHUNKS_PATH, "r", encoding="utf-8") as f:
    _chunks: list[dict] = json.load(f)

# Build BM25 index over the text of every chunk
console.print("Building BM25 index...", style="bold cyan")
_bm25_corpus = [chunk["text"].lower().split() for chunk in _chunks]
_bm25 = BM25Okapi(_bm25_corpus)

# CrossEncoder reranker
console.print(f"Loading reranker model [bold]{RERANKER_MODEL}[/bold]...", style="bold cyan")
_reranker = CrossEncoder(RERANKER_MODEL)

# Groq LLM
console.print(f"Initializing Groq LLM ([bold]{GROQ_MODEL}[/bold])...", style="bold cyan")
_llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL)

console.print("[bold green]Retriever ready.[/bold green]")


# ---------------------------------------------------------------------------
# Part 2 — Query Rewriter
# Rewrites the raw user query into a more search-friendly form using Groq.
# ---------------------------------------------------------------------------

def rewrite_query(query: str) -> str:
    """Rewrite user query to improve retrieval recall."""
    messages = [
        SystemMessage(content=(
            "You are a search query optimizer for a project management SaaS support system "
            "called Flowdesk. Rewrite the user query to be more specific and search-friendly. "
            "Return only the rewritten query, nothing else. "
            "Preserve key action words from the original query such as invite, delete, cancel, "
            "create, export, archive. Do not replace them with synonyms as this reduces retrieval "
            "accuracy. Keep the rewritten query concise."
        )),
        HumanMessage(content=query),
    ]
    response = _llm.invoke(messages)
    rewritten = response.content.strip()
    console.print(f"Query rewrite: [dim]{query}[/dim] → [bold yellow]{rewritten}[/bold yellow]")
    return rewritten


# ---------------------------------------------------------------------------
# Part 3 — Dense Retriever
# Embeds the query and searches Pinecone for semantically similar chunks.
# ---------------------------------------------------------------------------

def dense_search(query: str, source_filter: str = None) -> list[dict]:
    """Search Pinecone using dense vector similarity."""
    embedding = get_single_embedding(query)
    response = _index.query(vector=embedding, top_k=TOP_K_DENSE, include_metadata=True)

    results = []
    for match in response.matches:
        meta = match.metadata
        header = meta.get("header", "")
        # Filter out document-title chunks (no ">" means no sub-header context)
        if ">" not in header:
            continue
        results.append({
            "id": match.id,
            "text": meta.get("page_content", ""),
            "source": meta.get("source", ""),
            "header": header,
            "chunk_index": meta.get("chunk_index", 0),
            "score": match.score,
        })

    # Sort matching source to the front while preserving relative order within each group
    if source_filter:
        results.sort(key=lambda c: 0 if c["source"] == source_filter else 1)
    return results


# ---------------------------------------------------------------------------
# Part 4 — BM25 Retriever
# Keyword-based sparse search over the locally stored chunks.
# ---------------------------------------------------------------------------

def bm25_search(query: str, source_filter: str = None) -> list[dict]:
    """Search chunks using BM25 sparse keyword matching."""
    tokenized_query = query.lower().split()
    scores = _bm25.get_scores(tokenized_query)

    # Pair each chunk with its BM25 score and take top TOP_K_DENSE
    scored = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)[:TOP_K_DENSE]

    results = []
    for idx, score in scored:
        chunk = _chunks[idx]
        header = chunk.get("header", "")
        # Filter out document-title chunks (no ">" means no sub-header context)
        if ">" not in header:
            continue
        results.append({
            "id": chunk["id"],
            "text": chunk["text"],
            "source": chunk["source"],
            "header": header,
            "chunk_index": chunk["chunk_index"],
            "score": float(score),
        })

    # Sort matching source to the front while preserving relative order within each group
    if source_filter:
        results.sort(key=lambda c: 0 if c["source"] == source_filter else 1)
    return results


# ---------------------------------------------------------------------------
# Part 5 — Merge Function
# Combines dense and BM25 results, deduplicating by chunk id.
# ---------------------------------------------------------------------------

def merge_results(dense_results: list[dict], bm25_results: list[dict]) -> list[dict]:
    """Merge dense and BM25 results, removing duplicates by id."""
    seen_ids: set[str] = set()
    merged: list[dict] = []

    for chunk in dense_results + bm25_results:
        if chunk["id"] not in seen_ids:
            seen_ids.add(chunk["id"])
            merged.append(chunk)

    console.print(f"Merged results: [bold]{len(merged)}[/bold] unique chunks "
                  f"([dim]{len(dense_results)} dense + {len(bm25_results)} BM25[/dim])")
    return merged


# ---------------------------------------------------------------------------
# Part 6 — CrossEncoder Reranker
# Scores each candidate chunk against the query and keeps the top results.
# ---------------------------------------------------------------------------

def rerank(query: str, chunks: list[dict]) -> list[dict]:
    """Rerank merged chunks using CrossEncoder and return top TOP_K_RERANKED."""
    if not chunks:
        return []

    # Truncate to 800 chars so CrossEncoder scores all chunks on equal footing
    pairs = [[query, chunk["text"][:800]] for chunk in chunks]
    scores = _reranker.predict(pairs)

    for chunk, score in zip(chunks, scores):
        chunk["rerank_score"] = float(score)

    ranked = sorted(chunks, key=lambda c: c["rerank_score"], reverse=True)
    top = ranked[:TOP_K_RERANKED]

    console.print("Reranking scores (top results):")
    for chunk in top:
        console.print(
            f"  [bold]{chunk['rerank_score']:.4f}[/bold]  {chunk['header']}",
            style="dim"
        )
    return top


# ---------------------------------------------------------------------------
# Part 7 — Contextual Compression
# Extracts only the sentences in each chunk that are relevant to the query.
# ---------------------------------------------------------------------------

def compress_chunks(query: str, chunks: list[dict]) -> list[dict]:
    """Compress each chunk to only the sentences relevant to the query."""
    system_prompt = (
        "You are a text extraction assistant. Your only job is to extract relevant sentences "
        "from a given text. You must follow these rules strictly: "
        "Rule 1 — Return ONLY the extracted sentences, nothing else. "
        "Rule 2 — Do NOT explain, narrate, or comment. "
        "Rule 3 — Do NOT say things like 'the information is not available' or 'no relevant text found'. "
        "Rule 4 — If nothing is relevant, return exactly this and nothing else: EMPTY. "
        "Rule 5 — Do NOT add any information not present in the original text. "
        "Rule 6 — Always preserve specific numbers, prices, percentages, error codes, and "
        "step-by-step instructions even if they seem only partially relevant. Never remove numerical data."
    )

    compressed = []
    for chunk in chunks:
        user_prompt = (
            f"Query: {query}\n\n"
            f"Text: {chunk['text']}\n\n"
            f"Extract only the sentences from the text that directly help answer the query. "
            f"Return extracted sentences only."
        )
        response = _llm.invoke([SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)])
        extracted = response.content.strip()

        if extracted != "EMPTY":
            chunk = chunk.copy()
            chunk["text"] = extracted
            compressed.append(chunk)

    return compressed


# ---------------------------------------------------------------------------
# Part 8 — Main Retrieval Pipeline
# Orchestrates all stages from query rewriting to final compressed results.
# ---------------------------------------------------------------------------

def retrieve(query: str, source_filter: str = None, skip_compression: bool = False) -> list[dict]:
    """
    Full retrieval pipeline:
      rewrite_query → dense_search → bm25_search → merge_results → rerank → compress_chunks
    """
    console.print(f"\n[bold blue]--- Retrieving for:[/bold blue] {query}")
    if source_filter:
        console.print(f"  Source filter: [bold]{source_filter}[/bold]")

    rewritten = rewrite_query(query)

    # Dual dense search: run on both rewritten and original query for maximum recall
    dense_results_rewritten = dense_search(rewritten, source_filter=source_filter)
    dense_results_original = dense_search(query, source_filter=source_filter)
    dense_results = merge_results(dense_results_rewritten, dense_results_original)
    console.print(
        f"Dual dense search: [bold]{len(dense_results_rewritten)}[/bold] rewritten + "
        f"[bold]{len(dense_results_original)}[/bold] original → "
        f"[bold]{len(dense_results)}[/bold] merged"
    )

    bm25_results = bm25_search(rewritten, source_filter=source_filter)
    merged = merge_results(dense_results, bm25_results)
    reranked = rerank(rewritten, merged)

    if skip_compression:
        console.print("Compression skipped for billing query", style="yellow")
        final = reranked
    else:
        final = compress_chunks(query, reranked)

    console.print(f"\n[bold green]Retrieved {len(final)} chunk(s):[/bold green]")
    for chunk in final:
        console.print(f"  [cyan]{chunk['source']}[/cyan]  {chunk['header']}")
        console.print(f"  [dim]{chunk['text'][:120]}...[/dim]\n")

    return final


# ---------------------------------------------------------------------------
# Part 9 — Test block
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    test_queries = [
        "it's not working",                              # very vague query
        "how much does it cost",                         # billing intent
        "can I get my money back",                       # refund intent
        "my team can't see the project I created",       # technical issue
        "what is the difference between admin and member",  # FAQ intent
        "FD-503 error",                                  # specific error code
        "I want to delete my account",                   # escalation-worthy query
    ]

    for q in test_queries:
        console.rule(f"[bold magenta]Query: {q}[/bold magenta]")
        retrieve(q)
        console.print()
