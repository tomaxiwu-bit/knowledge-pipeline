# Knowledge Pipeline v0.3.1 — Verification and Security Hardening

## What changed

- Replaces broad backend dependency ranges with a committed `uv.lock` and exact exported `requirements*.txt` files. CI and release builds synchronise the locked test environment before verification.
- Adds 35 backend tests: `KnowledgeService` orchestration, all five public API endpoints, configuration validation, storage/FTS behaviour, hybrid retrieval, and local model/vector adapters.
- Enforces 85% branch-aware backend coverage. The v0.3.1 suite currently reports 88.55% total coverage and 97% for `app/service.py`.
- Adds renderer-side and main-process RAG contract tests, increasing desktop tests to six files / thirteen tests.
- Replaces FTS query escaping with an allow-listed tokeniser, validates document IDs at the delete endpoint, and rejects unknown `.env` variables at startup.

## Operational note

`sentence-transformers` is intentionally an optional, separately locked `rerank` group. The default deployment remains lightweight and uses lexical reranking; opt into the local cross-encoder only when it is configured and installed.
