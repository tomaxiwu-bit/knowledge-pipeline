from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol

from .storage import KnowledgeStore, StoredChunk
from .vector import ChromaVectorIndex


def reciprocal_rank_fusion(rankings: list[list[str]], k: int = 60) -> list[tuple[str, float]]:
    """Merge retrieval rankings without assuming their raw scores are comparable."""
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, item_id in enumerate(ranking, start=1):
            scores[item_id] = scores.get(item_id, 0.0) + 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda item: (-item[1], item[0]))


class Reranker(Protocol):
    def rank(self, query: str, candidates: list[tuple[StoredChunk, float]]) -> list[tuple[StoredChunk, float]]: ...


class LexicalReranker:
    """Fast, dependency-free fallback reranker used when no local model is enabled."""

    def rank(self, query: str, candidates: list[tuple[StoredChunk, float]]) -> list[tuple[StoredChunk, float]]:
        terms = set(re.findall(r'[\w\u4e00-\u9fff]+', query.lower(), re.UNICODE))
        def score(item: tuple[StoredChunk, float]) -> float:
            chunk, fused = item
            text = f'{chunk.title} {chunk.content}'.lower()
            coverage = sum(1 for term in terms if term in text) / max(len(terms), 1)
            title_bonus = sum(1 for term in terms if term in chunk.title.lower()) / max(len(terms), 1)
            return fused + coverage * 0.1 + title_bonus * 0.04
        return sorted(candidates, key=score, reverse=True)


class CrossEncoderReranker:
    """Optional local cross-encoder reranker; models never require a cloud API."""

    def __init__(self, model_name: str) -> None:
        from sentence_transformers import CrossEncoder
        self.model = CrossEncoder(model_name)

    def rank(self, query: str, candidates: list[tuple[StoredChunk, float]]) -> list[tuple[StoredChunk, float]]:
        if not candidates:
            return []
        scores = self.model.predict([(query, candidate.content) for candidate, _ in candidates])
        scored = [(candidate, float(score)) for (candidate, _), score in zip(candidates, scores, strict=True)]
        return sorted(scored, key=lambda item: item[1], reverse=True)


@dataclass(frozen=True)
class RetrievalResult:
    candidates: list[tuple[StoredChunk, float]]
    keyword_count: int
    vector_count: int
    reranker: str


class HybridRetriever:
    def __init__(self, store: KnowledgeStore, vector_index: ChromaVectorIndex, embeddings: object, reranker: Reranker, reranker_name: str) -> None:
        self.store = store
        self.vector_index = vector_index
        self.embeddings = embeddings
        self.reranker = reranker
        self.reranker_name = reranker_name

    async def retrieve(self, query: str, limit: int) -> RetrievalResult:
        keyword = self.store.keyword_search(query, max(limit * 3, 12))
        vector_ids: list[str] = []
        try:
            embedding = (await self.embeddings.embeddings([query]))[0]
            vector_ids = self.vector_index.search(embedding, max(limit * 3, 12))
        except Exception:
            # SQLite remains a useful and reliable keyword fallback when a local
            # embedding model is still downloading or intentionally disabled.
            vector_ids = []

        keyword_ids = [chunk.id for chunk in keyword]
        fused = reciprocal_rank_fusion([keyword_ids, vector_ids])
        chunks = {chunk.id: chunk for chunk in keyword}
        chunks.update({chunk.id: chunk for chunk in self.store.get_chunks(vector_ids)})
        candidates = [(chunks[chunk_id], score) for chunk_id, score in fused if chunk_id in chunks]
        reranked = self.reranker.rank(query, candidates)[:limit]
        return RetrievalResult(reranked, len(keyword_ids), len(vector_ids), self.reranker_name)
