from sentence_transformers import SentenceTransformer
from utils.logger import get_logger
from config import EMBEDDING_MODEL

console = get_logger()

console.print("Loading embedding model...", style="bold cyan")
_model = SentenceTransformer(EMBEDDING_MODEL)


def get_embeddings(texts: list[str]) -> list[list[float]]:
    embeddings = _model.encode(texts, normalize_embeddings=True)
    return embeddings.tolist()


def get_single_embedding(text: str) -> list[float]:
    embedding = _model.encode(text, normalize_embeddings=True)
    return embedding.tolist()
