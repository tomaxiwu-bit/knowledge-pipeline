import asyncio
import sys
from types import SimpleNamespace

import httpx
import pytest

from app.ollama import OllamaClient, OllamaUnavailable
from app.vector import ChromaVectorIndex


def run(coroutine):
    return asyncio.run(coroutine)


class FakeResponse:
    def __init__(self, payload, error=None):
        self.payload = payload
        self.error = error

    def raise_for_status(self):
        if self.error:
            raise self.error

    def json(self):
        return self.payload


class FakeHttpClient:
    def __init__(self, response):
        self.response = response
        self.requests = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, url, json):
        self.requests.append((url, json))
        return self.response


def test_ollama_embeddings_and_chat_use_expected_local_endpoints(monkeypatch):
    fake = FakeHttpClient(FakeResponse({'embeddings': [[1, 2]], 'message': {'content': 'ignored'}}))
    monkeypatch.setattr('app.ollama.httpx.AsyncClient', lambda timeout: fake)
    client = OllamaClient('http://ollama.test/', 'embed-model', 'chat-model', 5)

    assert run(client.embeddings(['first'])) == [[1.0, 2.0]]
    assert fake.requests[-1] == ('http://ollama.test/api/embed', {'model': 'embed-model', 'input': ['first'], 'truncate': True})

    fake.response = FakeResponse({'message': {'content': ' grounded '}})
    assert run(client.chat([{'role': 'user', 'content': 'hello'}])) == 'grounded'
    assert fake.requests[-1][0] == 'http://ollama.test/api/chat'


@pytest.mark.parametrize('response', [FakeResponse({}), FakeResponse({'embeddings': []})])
def test_ollama_rejects_invalid_embedding_responses(monkeypatch, response):
    monkeypatch.setattr('app.ollama.httpx.AsyncClient', lambda timeout: FakeHttpClient(response))
    with pytest.raises(OllamaUnavailable):
        run(OllamaClient('http://ollama.test', 'embed', 'chat', 5).embeddings(['first']))


def test_ollama_wraps_transport_errors(monkeypatch):
    response = FakeResponse({}, error=httpx.ConnectError('offline'))
    monkeypatch.setattr('app.ollama.httpx.AsyncClient', lambda timeout: FakeHttpClient(response))

    with pytest.raises(OllamaUnavailable, match='Ollama is unavailable'):
        run(OllamaClient('http://ollama.test', 'embed', 'chat', 5).chat([]))


class FakeCollection:
    def __init__(self):
        self.upserts = []
        self.deleted = []

    def upsert(self, **kwargs):
        self.upserts.append(kwargs)

    def delete(self, **kwargs):
        self.deleted.append(kwargs)

    def query(self, **kwargs):
        self.query_args = kwargs
        return {'ids': [['chunk-2', 'chunk-1']]}

    def count(self):
        return 2


def test_chroma_adapter_isolated_behind_small_interface(monkeypatch):
    collection = FakeCollection()
    client = SimpleNamespace(get_or_create_collection=lambda **kwargs: collection)
    monkeypatch.setitem(sys.modules, 'chromadb', SimpleNamespace(PersistentClient=lambda path: client))
    index = ChromaVectorIndex('/tmp/chroma-test')

    index.upsert(['chunk-1'], [[0.1]], ['text'], [{'document_id': 'doc'}])
    index.delete([])
    index.delete(['chunk-1'])

    assert collection.upserts[0]['ids'] == ['chunk-1']
    assert collection.deleted == [{'ids': ['chunk-1']}]
    assert index.search([0.2], 4) == ['chunk-2', 'chunk-1']
    assert collection.query_args['n_results'] == 4
    assert index.count() == 2


def test_chroma_adapter_explains_missing_dependency(monkeypatch):
    monkeypatch.setitem(sys.modules, 'chromadb', None)
    with pytest.raises(RuntimeError, match='Chroma is not installed'):
        ChromaVectorIndex('/tmp/chroma-test')
