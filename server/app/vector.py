from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import chromadb


class ChromaVectorIndex:
    """Small adapter that keeps Chroma optional to the canonical SQLite store."""

    def __init__(self, path: str) -> None:
        try:
            import chromadb
        except ImportError as error:
            raise RuntimeError('Chroma is not installed. Run: pip install -r server/requirements.txt') from error
        self.client = chromadb.PersistentClient(path=path)
        self.collection = self.client.get_or_create_collection(
            name='knowledge_chunks', metadata={'hnsw:space': 'cosine'}
        )

    def upsert(self, ids: list[str], embeddings: list[list[float]], documents: list[str], metadatas: list[dict[str, str]]) -> None:
        if not ids:
            return
        self.collection.upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)

    def delete(self, ids: list[str]) -> None:
        if ids:
            self.collection.delete(ids=ids)

    def search(self, embedding: list[float], limit: int) -> list[str]:
        result: dict[str, Any] = self.collection.query(
            query_embeddings=[embedding], n_results=limit, include=['distances']
        )
        ids = result.get('ids', [[]])
        return [str(item) for item in (ids[0] if ids else [])]

    def count(self) -> int:
        return int(self.collection.count())
