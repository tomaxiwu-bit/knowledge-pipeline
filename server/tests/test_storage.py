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


if __name__ == '__main__':
    unittest.main()
