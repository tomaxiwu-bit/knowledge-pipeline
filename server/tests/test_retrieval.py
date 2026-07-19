import unittest
import asyncio

from app.retrieval import HybridRetriever, LexicalReranker, RetrievalResult, reciprocal_rank_fusion
from app.storage import StoredChunk


class RetrievalTests(unittest.TestCase):
    def test_rrf_rewards_agreement_between_retrievers(self):
        fused = reciprocal_rank_fusion([['a', 'b'], ['b', 'c']])
        self.assertEqual(fused[0][0], 'b')
        self.assertGreater(fused[0][1], fused[-1][1])

    def test_rrf_has_deterministic_tie_breaker(self):
        fused = reciprocal_rank_fusion([['z'], ['a']])
        self.assertEqual([item for item, _ in fused], ['a', 'z'])

    def test_lexical_reranker_rewards_title_and_term_coverage(self):
        relevant = self.chunk('Local evidence', 'Local evidence supports the decision.')
        unrelated = self.chunk('Other material', 'This is not related.')
        ranked = LexicalReranker().rank('local evidence', [(unrelated, 0.1), (relevant, 0.1)])
        self.assertEqual(ranked[0][0].id, relevant.id)

    def test_hybrid_retriever_fuses_keyword_and_vector_candidates(self):
        keyword = self.chunk('Keyword', 'keyword evidence', 'chunk-keyword')
        vector = self.chunk('Vector', 'semantic evidence', 'chunk-vector')

        class Store:
            def keyword_search(self, _query, _limit): return [keyword]
            def get_chunks(self, ids): return [vector] if ids == ['chunk-vector'] else []
        class Vectors:
            def search(self, _embedding, _limit): return ['chunk-vector']
        class Embeddings:
            async def embeddings(self, _texts): return [[0.1]]

        result = asyncio.run(HybridRetriever(Store(), Vectors(), Embeddings(), LexicalReranker(), 'lexical').retrieve('evidence', 5))
        self.assertEqual({chunk.id for chunk, _ in result.candidates}, {'chunk-keyword', 'chunk-vector'})
        self.assertEqual((result.keyword_count, result.vector_count), (1, 1))

    def test_hybrid_retriever_keeps_keyword_results_when_embeddings_fail(self):
        keyword = self.chunk('Keyword', 'keyword evidence', 'chunk-keyword')

        class Store:
            def keyword_search(self, _query, _limit): return [keyword]
            def get_chunks(self, _ids): return []
        class Vectors:
            def search(self, _embedding, _limit): raise AssertionError('should not search')
        class Embeddings:
            async def embeddings(self, _texts): raise RuntimeError('offline')

        result = asyncio.run(HybridRetriever(Store(), Vectors(), Embeddings(), LexicalReranker(), 'lexical').retrieve('evidence', 5))
        self.assertEqual([chunk.id for chunk, _ in result.candidates], ['chunk-keyword'])
        self.assertEqual(result.vector_count, 0)

    @staticmethod
    def chunk(title: str, content: str, chunk_id: str = 'chunk') -> StoredChunk:
        return StoredChunk(chunk_id, 'doc', 0, content, 'manual', 'source', title, None, [])


if __name__ == '__main__':
    unittest.main()
