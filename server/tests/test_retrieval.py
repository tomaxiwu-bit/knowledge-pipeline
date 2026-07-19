import unittest

from app.retrieval import reciprocal_rank_fusion


class RetrievalTests(unittest.TestCase):
    def test_rrf_rewards_agreement_between_retrievers(self):
        fused = reciprocal_rank_fusion([['a', 'b'], ['b', 'c']])
        self.assertEqual(fused[0][0], 'b')
        self.assertGreater(fused[0][1], fused[-1][1])

    def test_rrf_has_deterministic_tie_breaker(self):
        fused = reciprocal_rank_fusion([['z'], ['a']])
        self.assertEqual([item for item, _ in fused], ['a', 'z'])


if __name__ == '__main__':
    unittest.main()
