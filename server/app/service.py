from __future__ import annotations

from dataclasses import dataclass

from .chunking import chunk_text
from .ollama import OllamaClient, OllamaUnavailable
from .retrieval import HybridRetriever
from .schemas import AskResponse, Citation, DocumentInput, IndexedDocument, SearchResponse
from .storage import KnowledgeStore, StoredChunk
from .vector import ChromaVectorIndex


@dataclass
class KnowledgeService:
    store: KnowledgeStore
    vector_index: ChromaVectorIndex
    ollama: OllamaClient
    retriever: HybridRetriever

    async def index(self, document: DocumentInput) -> IndexedDocument:
        chunks = chunk_text(document.content)
        if not chunks:
            raise ValueError('Document has no indexable text')
        document_id = self.store.upsert_document(
            source_type=document.source_type, source_id=document.source_id, title=document.title,
            url=document.url, tags=document.tags, content=document.content,
        )
        previous_chunk_ids = self.store.chunk_ids(document_id)
        chunk_ids = self.store.replace_chunks(document_id, [chunk.content for chunk in chunks])
        semantic_error: str | None = None
        try:
            embeddings = await self.ollama.embeddings([chunk.content for chunk in chunks])
            self.vector_index.upsert(
                chunk_ids, embeddings, [chunk.content for chunk in chunks],
                [
                    {'document_id': document_id, 'source_type': document.source_type, 'source_id': document.source_id}
                    for _ in chunks
                ],
            )
            # Only delete stale prior vectors after the new embeddings are
            # safely in Chroma. Old and new chunk_ids can overlap (same
            # document_id:ordinal), so remove only IDs that are no longer
            # present. If the embedding pass failed above, old vectors are
            # preserved so semantic search still finds the document.
            new_id_set = set(chunk_ids)
            stale_ids = [old_id for old_id in previous_chunk_ids if old_id not in new_id_set]
            if stale_ids:
                self.vector_index.delete(stale_ids)
        except OllamaUnavailable as error:
            semantic_error = str(error)
        return IndexedDocument(
            document_id=document_id, chunk_count=len(chunks), semantic_indexed=semantic_error is None,
            semantic_error=semantic_error,
        )

    async def delete(self, document_id: str) -> None:
        self.vector_index.delete(self.store.delete_document(document_id))

    async def search(self, query: str, limit: int) -> SearchResponse:
        result = await self.retriever.retrieve(query, limit)
        citations = self._citations(result.candidates)
        return SearchResponse(
            query=query, results=citations,
            retrieval={'keyword_candidates': result.keyword_count, 'vector_candidates': result.vector_count, 'reranker': result.reranker},
        )

    async def ask(self, query: str, limit: int, include_context: bool) -> AskResponse:
        result = await self.retriever.retrieve(query, limit)
        citations = self._citations(result.candidates)
        context = self._context(citations, result.candidates)
        mode = 'retrieval_only'
        if not citations:
            answer = '知识库中还没有可支持这个问题的材料。请先同步或将文章加入知识库。'
        else:
            try:
                answer = await self.ollama.chat([
                    {'role': 'system', 'content': '你是知识流水线的本地问答助手。只能根据给定证据回答；不确定时明确说明。每个关键判断后用 [编号] 标注来源。使用与用户相同的语言。'},
                    {'role': 'user', 'content': f'问题：{query}\n\n证据：\n{context}'},
                ])
                mode = 'grounded_generation'
            except OllamaUnavailable:
                answer = '本地对话模型当前不可用。以下是按相关性排序的已检索证据，请基于来源自行判断。'
        return AskResponse(
            query=query, answer=answer, citations=citations, mode=mode,
            retrieval={'keyword_candidates': result.keyword_count, 'vector_candidates': result.vector_count, 'reranker': result.reranker},
            context=context if include_context else None,
        )

    @staticmethod
    def _citations(candidates: list[tuple[StoredChunk, float]]) -> list[Citation]:
        return [
            Citation(
                index=index, chunk_id=chunk.id, document_id=chunk.document_id, source_type=chunk.source_type,
                source_id=chunk.source_id, title=chunk.title, url=chunk.url,
                excerpt=chunk.content[:420].strip(), score=round(score, 5),
            )
            for index, (chunk, score) in enumerate(candidates, start=1)
        ]

    @staticmethod
    def _context(citations: list[Citation], candidates: list[tuple[StoredChunk, float]]) -> str:
        blocks = []
        for citation, (chunk, _) in zip(citations, candidates, strict=True):
            source = f'{citation.title}' + (f' — {citation.url}' if citation.url else '')
            blocks.append(f'[{citation.index}] {source}\n{chunk.content[:1800]}')
        return '\n\n'.join(blocks)
