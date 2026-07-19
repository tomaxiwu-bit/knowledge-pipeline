from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response, status

from .config import get_settings
from .ollama import OllamaClient
from .retrieval import CrossEncoderReranker, HybridRetriever, LexicalReranker
from .schemas import AskRequest, AskResponse, DocumentInput, IndexedDocument, SearchRequest, SearchResponse
from .service import KnowledgeService
from .storage import KnowledgeStore
from .vector import ChromaVectorIndex


def build_service() -> KnowledgeService:
    settings = get_settings()
    store = KnowledgeStore(settings.database_path)
    store.initialise()
    vectors = ChromaVectorIndex(str(settings.chroma_path))
    ollama = OllamaClient(settings.ollama_base_url, settings.ollama_embed_model, settings.ollama_chat_model, settings.request_timeout_seconds)
    reranker_name = 'lexical'
    reranker = LexicalReranker()
    if settings.reranker_mode.lower() == 'cross_encoder':
        try:
            reranker = CrossEncoderReranker(settings.reranker_model)
            reranker_name = f'cross_encoder:{settings.reranker_model}'
        except Exception:
            reranker_name = 'lexical (cross-encoder unavailable)'
    return KnowledgeService(store, vectors, ollama, HybridRetriever(store, vectors, ollama, reranker, reranker_name))


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.knowledge = build_service()
    yield


app = FastAPI(
    title='Knowledge Pipeline Intelligence Service', version='0.3.0',
    description='Local-first SQLite + Chroma hybrid retrieval and grounded knowledge Q&A.',
    lifespan=lifespan,
)


def service() -> KnowledgeService:
    return app.state.knowledge


@app.get('/health')
async def health() -> dict[str, object]:
    settings = get_settings()
    return {
        'status': 'ok', 'version': app.version, 'storage': service().store.stats(),
        'vectors': service().vector_index.count(), 'ollama_base_url': settings.ollama_base_url,
        'reranker_mode': settings.reranker_mode,
    }


@app.post('/api/v1/knowledge/documents', response_model=IndexedDocument, status_code=status.HTTP_201_CREATED)
async def index_document(document: DocumentInput) -> IndexedDocument:
    try:
        return await service().index(document)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.delete('/api/v1/knowledge/documents/{document_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: str) -> Response:
    await service().delete(document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post('/api/v1/knowledge/search', response_model=SearchResponse)
async def search_knowledge(request: SearchRequest) -> SearchResponse:
    return await service().search(request.query, request.limit)


@app.post('/api/v1/knowledge/ask', response_model=AskResponse)
async def ask_knowledge(request: AskRequest) -> AskResponse:
    return await service().ask(request.query, request.limit, request.include_context)
