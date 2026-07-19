# 0.1.1 Hardening Update

This update focuses on safe releases rather than adding new product features.

## Included changes

- Repaired the npm lockfile and added `npm run verify`.
- Added unit tests, GitHub Actions CI, and weekly Dependabot updates.
- Updated Electron, Vite, electron-builder, and related build tooling; `npm audit --audit-level=high` is clean.
- Moved configured backend clients and API credentials to the Electron main process.
- Stored API credentials separately from app settings using the operating system's secure credential storage.
- Restricted the preload API to an allow-listed settings surface and adapter operations.
- Removed the global CORS response-header override because external requests now originate in the main process.
- Hardened external navigation, permissions, Mermaid rendering, and exported HTML.
- Persisted custom templates and corrected documentation that overstated currently implemented adapters.

## Before releasing

1. Run `npm ci` and `npm run verify`.
2. Run `npm run electron:build` on the target release platform.
3. On each supported operating system, add a test backend and confirm that its API key remains absent from the renderer settings response and the regular settings file.
4. Replace the default Windows installer icon with a product-owned `.ico` asset before public distribution.

## Current support boundary

FreshRSS, Karakeep, Memos, OpenAI-compatible APIs, and Ollama are implemented. Additional backend names in the adapter table are extension targets, not current integrations.

## 0.1.2 Reliability boundary

- Successful read operations for RSS, bookmarks, memos, and RSS article content are cached locally for up to seven days.
- Cache fallback happens only after a live request fails and is labelled in the interface with its saved timestamp.
- The cache is limited to 250 entries and contains no credentials.
- Mutating operations are not queued, cached, or replayed. Users should retry a failed write after the backend is available.

## 0.2.0 Inquiry Thread boundary

- Inquiry Threads are local desktop metadata stored separately from service credentials.
- A thread retains a source reference, material role, optional user rationale, and timestamps. It does not duplicate external service content.
- Adding a personal reflection creates a normal memo through the configured memo service; it is never silently saved only in the desktop app.
- Thread exports are Markdown and include source URLs only when available.

## 0.2.1 Backup boundary

- Backup exports remove API Key, token, and password fields even if a caller supplies them.
- Backup imports validate the version, service URLs, service metadata, and collection bounds before writing local data.
- Restored service metadata may be used immediately, but credentials are never restored from the backup file.
