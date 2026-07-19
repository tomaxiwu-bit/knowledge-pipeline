# Knowledge Pipeline v0.3.0 — Local Intelligence Workbench

## Highlights

- Adds a standalone FastAPI intelligence service with SQLite FTS5 as the canonical local knowledge store.
- Adds persistent Chroma vectors, hybrid keyword/semantic retrieval, RRF fusion, and a local reranking path.
- Adds a desktop Knowledge Q&A view with evidence cards, source navigation, batch sync, and per-article indexing.
- Uses local Ollama for embeddings and grounded answers. If the model is unavailable, the product returns evidence-only retrieval instead of an ungrounded answer.
- Keeps the Electron security boundary: the renderer uses a narrow IPC interface; the main process only accepts a local loopback intelligence endpoint.

## Before publishing

1. Complete the manual RAG acceptance path in `RELEASE_CHECKLIST.md`.
2. Record the functional demo using `docs/DEMO_SCRIPT.md` and add its real link to the README.
3. Run `npm run release:check` and `npm run electron:build` on each distribution platform.
4. Create the annotated `v0.3.0` tag only after the checks pass, then publish the generated installer assets through the hosting provider's release UI.

## Deliberate scope

- The service is local-loopback only; multi-user cloud deployment, authentication, and remote database hosting are intentionally not enabled by default.
- Chroma is selected for a single-user, persistent local deployment. A Milvus adapter is a future scaling option, not a fake second implementation.
- Cross-encoder reranking is opt-in through `RERANKER_MODE=cross_encoder`; the default lexical reranker keeps first-run resource use predictable.
