from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class DocumentInput(BaseModel):
    source_type: Literal['rss', 'bookmark', 'memo', 'markdown', 'manual']
    source_id: str = Field(min_length=1, max_length=256)
    title: str = Field(min_length=1, max_length=500)
    content: str = Field(min_length=1, max_length=2_000_000)
    url: str | None = Field(default=None, max_length=2_048)
    tags: list[str] = Field(default_factory=list, max_length=60)


class IndexedDocument(BaseModel):
    document_id: str
    chunk_count: int
    semantic_indexed: bool
    semantic_error: str | None = None


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1_000)
    limit: int = Field(default=8, ge=1, le=20)


class Citation(BaseModel):
    index: int
    chunk_id: str
    document_id: str
    source_type: str
    source_id: str
    title: str
    url: str | None = None
    excerpt: str
    score: float


class SearchResponse(BaseModel):
    query: str
    results: list[Citation]
    retrieval: dict[str, object]


class AskRequest(SearchRequest):
    include_context: bool = False


class AskResponse(BaseModel):
    query: str
    answer: str
    citations: list[Citation]
    mode: Literal['grounded_generation', 'retrieval_only']
    retrieval: dict[str, object]
    context: str | None = None
