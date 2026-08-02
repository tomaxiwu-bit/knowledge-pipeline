import json

import pytest

from scripts.evaluate_retrieval import QueryCase, load_dataset, ndcg_at_k, percentile, recall_at_k, reciprocal_rank, summarize


def test_ranking_metrics_reward_early_relevant_results():
    ranked = ["wrong", "relevant", "also-relevant"]
    relevant = {"relevant", "also-relevant"}

    assert recall_at_k(ranked, relevant, 2) == 0.5
    assert reciprocal_rank(ranked, relevant) == 0.5
    assert 0 < ndcg_at_k(ranked, relevant, 3) < 1


def test_summary_reports_reproducible_quality_and_latency_metrics():
    cases = [
        QueryCase("first", frozenset({"a"})),
        QueryCase("second", frozenset({"b"})),
    ]

    result = summarize([["a", "x"], ["x", "b"]], cases, [10.0, 30.0], 2)

    assert result == {
        "queries": 2,
        "recall@2": 1.0,
        "mrr": 0.75,
        "ndcg@2": 0.8155,
        "latency_p50_ms": 20.0,
        "latency_p95_ms": 30.0,
    }


def test_summary_rejects_incomplete_runs():
    case = QueryCase("query", frozenset({"source"}))

    with pytest.raises(ValueError, match="identical lengths"):
        summarize([], [case], [1.0], 5)
    with pytest.raises(ValueError, match="at least one"):
        summarize([], [], [], 5)


def test_empty_metric_inputs_are_safe():
    assert recall_at_k([], set(), 5) == 0.0
    assert reciprocal_rank([], {"source"}) == 0.0
    assert ndcg_at_k([], set(), 5) == 0.0
    assert percentile([], 0.95) == 0.0


def test_dataset_rejects_duplicate_source_ids(tmp_path):
    dataset = tmp_path / "duplicate.json"
    dataset.write_text(json.dumps({
        "documents": [{"source_id": "same"}, {"source_id": "same"}],
        "queries": [{"query": "query", "relevant_source_ids": ["same"]}],
    }), encoding="utf-8")

    with pytest.raises(ValueError, match="unique source_id"):
        load_dataset(dataset)
