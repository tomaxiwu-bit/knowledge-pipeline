from dataclasses import dataclass
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import app.main as api
from app.schemas import AskResponse, IndexedDocument, SearchResponse


@dataclass
class FakeStore:
    documents: int = 2
    chunks: int = 6

    def stats(self):
        return {'documents': self.documents, 'chunks': self.chunks}


class FakeVectors:
    def count(self):
        return 6


class FakeKnowledgeService:
    def __init__(self):
        self.store = FakeStore()
        self.vector_index = FakeVectors()
        self.indexed = []
        self.deleted = []

    async def index(self, document):
        if document.title == 'fail':
            raise ValueError('Document has no indexable text')
        self.indexed.append(document)
        return IndexedDocument(document_id='doc_0123456789abcdef01234567', chunk_count=1, semantic_indexed=True)

    async def delete(self, document_id):
        self.deleted.append(document_id)

    async def search(self, query, limit):
        return SearchResponse(query=query, results=[], retrieval={'limit': limit, 'reranker': 'fake'})

    async def ask(self, query, limit, include_context):
        return AskResponse(
            query=query, answer='Grounded [1]', citations=[], mode='grounded_generation',
            retrieval={'limit': limit, 'reranker': 'fake'}, context='debug' if include_context else None,
        )


@pytest.fixture
def client(monkeypatch):
    fake = FakeKnowledgeService()
    monkeypatch.setattr(api, 'build_service', lambda: fake)
    monkeypatch.setattr(api, 'get_settings', lambda: SimpleNamespace(ollama_base_url='http://127.0.0.1:11434', reranker_mode='lexical'))
    with TestClient(api.app) as test_client:
        yield test_client, fake


def valid_document(**overrides):
    payload = {
        'source_type': 'rss', 'source_id': 'entry-1', 'title': 'A title',
        'content': 'A body', 'url': 'https://example.test/article', 'tags': ['research'],
    }
    payload.update(overrides)
    return payload


def test_health_endpoint_reports_storage_and_local_configuration(client):
    test_client, _ = client
    response = test_client.get('/health')

    assert response.status_code == 200
    assert response.json()['status'] == 'ok'
    assert response.json()['storage'] == {'documents': 2, 'chunks': 6}
    assert response.json()['vectors'] == 6


def test_index_endpoint_delegates_valid_document(client):
    test_client, fake = client
    response = test_client.post('/api/v1/knowledge/documents', json=valid_document())

    assert response.status_code == 201
    assert response.json()['semantic_indexed'] is True
    assert fake.indexed[0].source_id == 'entry-1'


def test_index_endpoint_returns_validation_and_service_errors(client):
    test_client, _ = client

    schema_error = test_client.post('/api/v1/knowledge/documents', json=valid_document(source_type='unknown'))
    service_error = test_client.post('/api/v1/knowledge/documents', json=valid_document(title='fail'))

    assert schema_error.status_code == 422
    assert service_error.status_code == 422
    assert service_error.json()['detail'] == 'Document has no indexable text'


def test_delete_endpoint_rejects_bad_document_id_and_delegates_valid_id(client):
    test_client, fake = client

    invalid = test_client.delete('/api/v1/knowledge/documents/not-a-document-id')
    deleted = test_client.delete('/api/v1/knowledge/documents/doc_0123456789abcdef01234567')

    assert invalid.status_code == 422
    assert deleted.status_code == 204
    assert fake.deleted == ['doc_0123456789abcdef01234567']


def test_search_endpoint_passes_query_and_limit(client):
    test_client, _ = client
    response = test_client.post('/api/v1/knowledge/search', json={'query': 'evidence', 'limit': 3})

    assert response.status_code == 200
    assert response.json() == {'query': 'evidence', 'results': [], 'retrieval': {'limit': 3, 'reranker': 'fake'}}


def test_ask_endpoint_passes_context_flag(client):
    test_client, _ = client
    response = test_client.post('/api/v1/knowledge/ask', json={'query': 'evidence', 'limit': 2, 'include_context': True})

    assert response.status_code == 200
    assert response.json()['answer'] == 'Grounded [1]'
    assert response.json()['context'] == 'debug'
