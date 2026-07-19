import tempfile
import unittest
from pathlib import Path

from app.storage import KnowledgeStore


class KnowledgeStoreTests(unittest.TestCase):
    def test_fts_returns_current_english_and_chinese_chunks(self):
        with tempfile.TemporaryDirectory() as directory:
            store = KnowledgeStore(Path(directory) / 'knowledge.sqlite3')
            store.initialise()
            document_id = store.upsert_document(
                source_type='manual', source_id='note-1', title='Local-first notes', url=None,
                tags=['research'], content='本地优先知识管理 keeps your evidence private.'
            )
            store.replace_chunks(document_id, ['本地优先知识管理 keeps your evidence private.'])
            self.assertEqual(store.keyword_search('evidence', 5)[0].document_id, document_id)
            self.assertEqual(store.keyword_search('知识管理', 5)[0].document_id, document_id)

    def test_replacing_chunks_removes_stale_keyword_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            store = KnowledgeStore(Path(directory) / 'knowledge.sqlite3')
            store.initialise()
            document_id = store.upsert_document(
                source_type='manual', source_id='note-2', title='Change log', url=None,
                tags=[], content='before'
            )
            store.replace_chunks(document_id, ['obsoleteonly'])
            store.replace_chunks(document_id, ['freshonly'])
            self.assertEqual(store.keyword_search('obsoleteonly', 5), [])
            self.assertEqual(store.keyword_search('freshonly', 5)[0].document_id, document_id)

    def test_fts_query_drops_match_syntax_instead_of_escaping_it(self):
        expression = KnowledgeStore._fts_query('" OR * NEAR(foo) -- safeentry')

        self.assertEqual(expression, '"FOO"* OR "SAFEENTRY"*')
        self.assertNotIn('NEAR(', expression)
        self.assertNotIn('--', expression)

    def test_fts_search_does_not_turn_syntax_payload_into_match_all(self):
        with tempfile.TemporaryDirectory() as directory:
            store = KnowledgeStore(Path(directory) / 'knowledge.sqlite3')
            store.initialise()
            first = store.upsert_document(source_type='manual', source_id='one', title='One', url=None, tags=[], content='safeentry')
            second = store.upsert_document(source_type='manual', source_id='two', title='Two', url=None, tags=[], content='unrelated')
            store.replace_chunks(first, ['safeentry'])
            store.replace_chunks(second, ['unrelated'])

            self.assertEqual(store.keyword_search('" OR *', 10), [])
            self.assertEqual([chunk.document_id for chunk in store.keyword_search('safeentry" OR *', 10)], [first])

    def test_store_returns_chunks_in_requested_order_and_deletes_document(self):
        with tempfile.TemporaryDirectory() as directory:
            store = KnowledgeStore(Path(directory) / 'knowledge.sqlite3')
            store.initialise()
            document_id = store.upsert_document(source_type='manual', source_id='one', title='One', url=None, tags=['tag'], content='content')
            chunk_ids = store.replace_chunks(document_id, ['first', 'second'])

            chunks = store.get_chunks(list(reversed(chunk_ids)))
            self.assertEqual([chunk.content for chunk in chunks], ['second', 'first'])
            self.assertEqual(store.stats(), {'documents': 1, 'chunks': 2})
            self.assertEqual(store.delete_document(document_id), chunk_ids)
            self.assertEqual(store.stats(), {'documents': 0, 'chunks': 0})


if __name__ == '__main__':
    unittest.main()
