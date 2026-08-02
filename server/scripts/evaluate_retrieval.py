from __future__ import annotations

import argparse
import json
import math
import statistics
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx


@dataclass(frozen=True)
class QueryCase:
    query: str
    relevant_source_ids: frozenset[str]


def recall_at_k(ranked: list[str], relevant: set[str] | frozenset[str], k: int) -> float:
    if not relevant:
        return 0.0
    return len(set(ranked[:k]) & set(relevant)) / len(relevant)


def reciprocal_rank(ranked: list[str], relevant: set[str] | frozenset[str]) -> float:
    for rank, source_id in enumerate(ranked, start=1):
        if source_id in relevant:
            return 1.0 / rank
    return 0.0


def ndcg_at_k(ranked: list[str], relevant: set[str] | frozenset[str], k: int) -> float:
    gains = [1.0 if source_id in relevant else 0.0 for source_id in ranked[:k]]
    dcg = sum(gain / math.log2(rank + 2) for rank, gain in enumerate(gains))
    ideal_hits = min(len(relevant), k)
    ideal = sum(1.0 / math.log2(rank + 2) for rank in range(ideal_hits))
    return dcg / ideal if ideal else 0.0


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = math.ceil((len(ordered) - 1) * fraction)
    return ordered[index]


def summarize(
    rankings: list[list[str]],
    cases: list[QueryCase],
    latencies_ms: list[float],
    k: int,
) -> dict[str, float | int]:
    if len(rankings) != len(cases) or len(latencies_ms) != len(cases):
        raise ValueError("rankings, cases, and latencies must have identical lengths")
    if not cases:
        raise ValueError("at least one evaluation query is required")

    recalls = [recall_at_k(ranked, case.relevant_source_ids, k) for ranked, case in zip(rankings, cases, strict=True)]
    reciprocal_ranks = [reciprocal_rank(ranked, case.relevant_source_ids) for ranked, case in zip(rankings, cases, strict=True)]
    ndcgs = [ndcg_at_k(ranked, case.relevant_source_ids, k) for ranked, case in zip(rankings, cases, strict=True)]
    return {
        "queries": len(cases),
        f"recall@{k}": round(statistics.fmean(recalls), 4),
        "mrr": round(statistics.fmean(reciprocal_ranks), 4),
        f"ndcg@{k}": round(statistics.fmean(ndcgs), 4),
        "latency_p50_ms": round(statistics.median(latencies_ms), 2),
        "latency_p95_ms": round(percentile(latencies_ms, 0.95), 2),
    }


def load_dataset(path: Path) -> tuple[list[dict[str, Any]], list[QueryCase]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    documents = payload.get("documents", [])
    raw_queries = payload.get("queries", [])
    if not documents or not raw_queries:
        raise ValueError("dataset must contain non-empty documents and queries arrays")
    source_ids = [document.get("source_id") for document in documents]
    if any(not source_id for source_id in source_ids) or len(source_ids) != len(set(source_ids)):
        raise ValueError("each document needs a unique source_id")

    cases = [
        QueryCase(
            query=item["query"],
            relevant_source_ids=frozenset(item["relevant_source_ids"]),
        )
        for item in raw_queries
    ]
    if any(not case.query or not case.relevant_source_ids for case in cases):
        raise ValueError("each query needs text and at least one relevant_source_id")
    return documents, cases


def run_benchmark(base_url: str, dataset: Path, k: int, timeout: float) -> dict[str, Any]:
    documents, cases = load_dataset(dataset)
    # Never reuse dataset IDs directly: the service upserts by source_type and
    # source_id, so a benchmark must not overwrite a real document that happens
    # to use the same identifier.
    run_id = uuid.uuid4().hex
    source_id_map = {
        document["source_id"]: f"benchmark-{run_id}-{document['source_id']}"
        for document in documents
    }
    documents = [
        {**document, "source_id": source_id_map[document["source_id"]]}
        for document in documents
    ]
    cases = [
        QueryCase(
            query=case.query,
            relevant_source_ids=frozenset(source_id_map[source_id] for source_id in case.relevant_source_ids),
        )
        for case in cases
    ]
    indexed_document_ids: list[str] = []
    rankings: list[list[str]] = []
    latencies_ms: list[float] = []
    retrieval_modes: set[str] = set()

    with httpx.Client(base_url=base_url.rstrip("/"), timeout=timeout) as client:
        health = client.get("/health")
        health.raise_for_status()
        try:
            for document in documents:
                response = client.post("/api/v1/knowledge/documents", json=document)
                response.raise_for_status()
                indexed_document_ids.append(response.json()["document_id"])

            for case in cases:
                started = time.perf_counter()
                response = client.post(
                    "/api/v1/knowledge/search",
                    json={"query": case.query, "limit": k},
                )
                response.raise_for_status()
                latencies_ms.append((time.perf_counter() - started) * 1_000)
                result = response.json()
                rankings.append([item["source_id"] for item in result["results"]])
                reranker = result.get("retrieval", {}).get("reranker")
                if reranker:
                    retrieval_modes.add(str(reranker))
        finally:
            for document_id in indexed_document_ids:
                response = client.delete(f"/api/v1/knowledge/documents/{document_id}")
                response.raise_for_status()

    return {
        "dataset": dataset.name,
        "base_url": base_url,
        "retrieval_modes": sorted(retrieval_modes),
        **summarize(rankings, cases, latencies_ms, k),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark a running Knowledge Pipeline retrieval service")
    parser.add_argument("--dataset", type=Path, default=Path("evaluation/biomedical-sample.json"))
    parser.add_argument("--base-url", default="http://127.0.0.1:8787")
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--timeout", type=float, default=60.0)
    args = parser.parse_args()
    if not 1 <= args.limit <= 20:
        parser.error("--limit must be between 1 and 20")

    result = run_benchmark(args.base_url, args.dataset, args.limit, args.timeout)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
