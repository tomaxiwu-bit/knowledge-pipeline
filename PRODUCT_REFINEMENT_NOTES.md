# Product Refinement Notes

## Goal

Make the first useful session clear and resilient: a new user should know what to connect, be able to check every connection, and still see recently fetched reading material when a self-hosted service has a short outage.

## Delivered

- A three-stage setup assistant on the home page for RSS, bookmarks, and memos.
- A “test all connections” action and per-service result feedback in settings.
- A bounded read cache for unread RSS items, article content, bookmarks, and memos.
  - Cache keys are scoped to the configured service, operation, and arguments.
  - Entries expire after seven days and the store is capped at 250 entries.
  - Cached results are only used after a live read fails and are visibly labelled with their timestamp.
  - Write operations are never queued, cached, or replayed.

## Comparative design input

| Project | Public capability observed | Product inference for Knowledge Pipeline |
|---|---|---|
| [Memos](https://github.com/usememos/memos) | Self-hosted, privacy-first note capture with a Markdown-based workflow | Prioritize a fast, low-ceremony path from first launch to first captured item. |
| [Linkwarden](https://github.com/linkwarden/linkwarden) | Self-hosted bookmark management and page preservation | Treat a saved link as something users expect to revisit, even if upstream availability is imperfect. |
| [Karakeep](https://github.com/karakeep-app/karakeep) | Self-hosted links, notes, images and PDFs with full-text search and optional automatic organization | Keep the pipeline focused on collection today, then add a deliberately local index rather than an unbounded UI cache. |
| [AFFiNE](https://github.com/toeverything/affine) | Privacy-focused workspace with local-first positioning | Build local reliability incrementally and make the data source visible in the interface. |
| [SiYuan](https://github.com/siyuan-note/siyuan) | Privacy-first, self-hosted personal knowledge management with structured document features | Preserve portability through Markdown exports and avoid making the desktop client the sole home of user data. |

## Next product milestones

1. Replace the short-lived JSON cache with a queryable local store (SQLite) that can serve full-text search offline.
2. Add a capture extension or share target for browser-to-pipeline collection.
3. Add backup retention, size reporting, and an optional encrypted archive for longer-term local records.
4. Add background refresh with visible last-sync timestamps and per-service retry controls.

## Non-goals of this release

- It is not a replacement for the backend services or their backups.
- It does not retain or replay writes while offline.
- It does not claim full offline mode; its cache is a read-only, short-term fallback.

## 0.2.0: Inquiry Threads — a distinctive product direction

### Problem chosen

Most tools optimize one part of personal knowledge work: capture, read-later, notes, references, links, or a graph. The lost step is usually the transition from “I saved this” to “what do I currently think, and what should I do next?”

### What we learned without copying

| Example | Strength worth learning from | What Knowledge Pipeline does differently |
|---|---|---|
| [Readeck](https://readeck.org/) | Preserves web material so it can be revisited | A saved web item can be assigned a role in a specific question, not just archived. |
| [SilverBullet](https://github.com/silverbulletmd/silverbullet) | Private, programmable personal knowledge database | The workflow is intentionally opinionated: question → material role → judgment → next move, without requiring scripts. |
| [Trilium](https://github.com/TriliumNext/trilium) | Large personal knowledge bases with rich organization | Instead of another hierarchy, a thread is a temporary, exportable reasoning unit that can span services. |
| [Zotero](https://github.com/zotero/zotero) | Source collection, annotation, citation and sharing | Sources retain their provenance, but the interface accepts non-academic RSS and bookmark material equally. |
| [Obsidian](https://obsidian.md/) | Freely linking notes to build a personal knowledge base | Relationships remain useful, but a thread explains why a relationship matters right now. |

### The unique workflow

An **Inquiry Thread** has five explicit fields: a question, material with roles, a working conclusion, a next action, and a portable Markdown brief. It is not a folder, graph, canvas, AI summary, or project-management list.

The reader is where new material enters the thread. A user chooses whether it is supporting evidence, a counterpoint, or context and may record why. Their own reflection becomes a memo, then returns to the same thread as a separate “own idea.” The resulting brief makes the provenance and the current state of thinking legible outside the app.

### Boundaries

- The app does not assign credibility or infer a conclusion automatically.
- A source is not copied into the thread; the thread retains a reference, a role, and optional rationale.
- No new cloud account, database, or AI provider is required.
- The feature works with the existing self-hosted adapter model and Markdown export philosophy.

### Next validation questions

1. Do users naturally begin with questions, or do they prefer to promote an existing saved search into a thread?
2. Which roles are useful in practice: is “evidence / counterpoint / context / reflection” enough, or should they be customizable?
3. Is the next-action field enough to cause productive follow-through, or does it need optional reminders?

## 0.2.1: Release-readiness baseline

- Local backup and restore now cover service metadata, relations, smart collections, custom templates, and Inquiry Threads.
- Credentials are intentionally excluded on both export and import; a restored profile must re-enter them through the protected settings flow.
- Backups have a versioned, bounded JSON format and reject invalid service URLs, malformed service records, unsupported versions, and oversized local collections.
- Inquiry Thread persistence normalizes malformed saved entries rather than allowing a corrupted or manually edited store to break the view.
- The repository now includes a cross-platform packaging workflow and a release checklist. Signing and notarization remain a distribution-environment responsibility.
