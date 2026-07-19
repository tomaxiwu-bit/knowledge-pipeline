import asyncio
from dataclasses import dataclass

from app.ollama import OllamaUnavailable
from app.retrieval import RetrievalResult
from app.schemas import DocumentInput
from app.service import KnowledgeService
from app.storage import StoredChunk


def run(coroutine):
    return asyncio.run(coroutine)


def candidate(content: str = 'Evidence text', title: str = 'Source title') -> StoredChunk:
    return StoredChunk(
        id='doc_0123456789abcdef01234567:0', document_id='doc_0123456789abcdef01234567', ordinal=0,
        content=content, source_type='rss', source_id='entry-1', title=title,
        url='https://example.test/article', tags=['research'],
    )


class FakeStore:
    def __init__(self):
        self.calls = []
        self.previous_ids = ['old:0']

    def upsert_document(self, **kwargs):
        self.calls.append(('upsert_document', kwargs))
        return 'doc_0123456789abcdef01234567'

    def chunk_ids(self, document_id):
        self.calls.append(('chunk_ids', document_id))
        return self.previous_ids

    def replace_chunks(self, document_id, chunks):
        self.calls.append(('replace_chunks', document_id, chunks))
        return [f'{document_id}:{index}' for index in range(len(chunks))]

    def delete_document(self, document_id):
        self.calls.append(('delete_document', document_id))
        return ['deleted:0']


class FakeVectors:
    def __init__(self):
        self.deleted = []
        self.upserts = []

    def delete(self, ids):
        self.deleted.append(ids)

    def upsert(self, ids, embeddings, documents, metadatas):
        self.upserts.append((ids, embeddings, documents, metadatas))


class FakeOllama:
    def __init__(self, *, embedding_error=False, chat_error=False):
        self.embedding_error = embedding_error
        self.chat_error = chat_error
        self.messages = []

    async def embeddings(self, texts):
        if self.embedding_error:
            raise OllamaUnavailable('embedding model unavailable')
        return [[0.1, 0.2] for _ in texts]

    async def chat(self, messages):
        self.messages.append(messages)
        if self.chat_error:
            raise OllamaUnavailable('chat model unavailable')
        return 'A grounded answer [1].'


@dataclass
class FakeRetriever:
    result: RetrievalResult

    async def retrieve(self, _query, _limit):
        return self.result


def make_service(*, retriever_result=None, ollama=None):
    result = retriever_result or RetrievalResult([], 0, 0, 'lexical')
    return KnowledgeService(FakeStore(), FakeVectors(), ollama or FakeOllama(), FakeRetriever(result))


def document():
    return DocumentInput(source_type='rss', source_id='entry-1', title='A source', content='A small body of evidence.', tags=['research'])


def test_index_replaces_prior_vectors_and_writes_semantic_embeddings():
    service = make_service()

    indexed = run(service.index(document()))

    assert indexed.document_id == 'doc_0123456789abcdef01234567'
    assert indexed.semantic_indexed is True
    assert indexed.semantic_error is None
    assert service.vector_index.deleted == [['old:0']]
    assert len(service.vector_index.upserts) == 1
    ids, embeddings, documents, metadata = service.vector_index.upserts[0]
    assert ids == ['doc_0123456789abcdef01234567:0']
    assert embeddings == [[0.1, 0.2]]
    assert documents == ['A small body of evidence.']
    assert metadata[0]['source_id'] == 'entry-1'


def test_index_remains_keyword_available_when_embedding_model_is_down():
    service = make_service(ollama=FakeOllama(embedding_error=True))

    indexed = run(service.index(document()))

    assert indexed.semantic_indexed is False
    assert indexed.semantic_error == 'embedding model unavailable'
    assert service.vector_index.deleted == [['old:0']]
    assert service.vector_index.upserts == []


def test_delete_removes_vectors_returned_by_canonical_store():
    service = make_service()

    run(service.delete('doc_0123456789abcdef01234567'))

    assert service.store.calls[-1] == ('delete_document', 'doc_0123456789abcdef01234567')
    assert service.vector_index.deleted == [['deleted:0']]


def test_search_maps_ranked_candidates_to_citations():
    item = candidate()
    service = make_service(retriever_result=RetrievalResult([(item, 0.234567)], 4, 3, 'lexical'))

    response = run(service.search('What is the evidence?', 8))

    assert response.query == 'What is the evidence?'
    assert response.results[0].index == 1
    assert response.results[0].excerpt == 'Evidence text'
    assert response.results[0].score == 0.23457
    assert response.retrieval == {'keyword_candidates': 4, 'vector_candidates': 3, 'reranker': 'lexical'}


def test_ask_returns_no_evidence_message_without_candidates():
    service = make_service()

    response = run(service.ask('What is known?', 8, False))

    assert response.mode == 'retrieval_only'
    assert response.citations == []
    assert '没有可支持' in response.answer
    assert response.context is None


def test_ask_generates_from_context_and_can_return_debug_context():
    item = candidate('Important evidence body')
    ollama = FakeOllama()
    service = make_service(retriever_result=RetrievalResult([(item, 0.3)], 1, 1, 'lexical'), ollama=ollama)

    response = run(service.ask('What matters?', 8, True))

    assert response.mode == 'grounded_generation'
    assert response.answer == 'A grounded answer [1].'
    assert '[1] Source title' in response.context
    assert 'Important evidence body' in ollama.messages[0][1]['content']


def test_ask_falls_back_to_evidence_when_chat_model_is_down():
    item = candidate()
    service = make_service(
        retriever_result=RetrievalResult([(item, 0.3)], 1, 0, 'lexical'),
        ollama=FakeOllama(chat_error=True),
    )

    response = run(service.ask('What matters?', 8, False))

    assert response.mode == 'retrieval_only'
    assert '对话模型当前不可用' in response.answer
    assert len(response.citations) == 1
