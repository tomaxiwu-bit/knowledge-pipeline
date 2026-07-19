from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path


@dataclass(frozen=True)
class StoredChunk:
    id: str
    document_id: str
    ordinal: int
    content: str
    source_type: str
    source_id: str
    title: str
    url: str | None
    tags: list[str]


class KnowledgeStore:
    """Canonical knowledge store with SQLite FTS5 keyword retrieval."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA foreign_keys = ON')
        return connection

    def initialise(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                '''
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    source_type TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    url TEXT,
                    tags_json TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(source_type, source_id)
                );
                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    ordinal INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE(document_id, ordinal)
                );
                CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                    chunk_id UNINDEXED,
                    document_id UNINDEXED,
                    title,
                    content,
                    tokenize = 'unicode61 remove_diacritics 2'
                );
                CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
                '''
            )

    @staticmethod
    def document_id(source_type: str, source_id: str) -> str:
        raw = f'{source_type}:{source_id}'.encode('utf-8')
        return f'doc_{hashlib.sha256(raw).hexdigest()[:24]}'

    @staticmethod
    def _timestamp() -> str:
        return datetime.now(UTC).isoformat()

    def upsert_document(self, *, source_type: str, source_id: str, title: str, url: str | None, tags: list[str], content: str) -> str:
        document_id = self.document_id(source_type, source_id)
        now = self._timestamp()
        content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()
        with self._connect() as connection:
            connection.execute(
                '''
                INSERT INTO documents (id, source_type, source_id, title, url, tags_json, content_hash, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(source_type, source_id) DO UPDATE SET
                  title = excluded.title,
                  url = excluded.url,
                  tags_json = excluded.tags_json,
                  content_hash = excluded.content_hash,
                  updated_at = excluded.updated_at
                ''',
                (document_id, source_type, source_id, title, url, json.dumps(tags, ensure_ascii=False), content_hash, now, now),
            )
        return document_id

    def replace_chunks(self, document_id: str, chunks: list[str]) -> list[str]:
        now = self._timestamp()
        chunk_ids = [f'{document_id}:{ordinal}' for ordinal in range(len(chunks))]
        with self._connect() as connection:
            connection.execute('DELETE FROM chunks_fts WHERE document_id = ?', (document_id,))
            connection.execute('DELETE FROM chunks WHERE document_id = ?', (document_id,))
            document = connection.execute('SELECT title FROM documents WHERE id = ?', (document_id,)).fetchone()
            title = document['title'] if document else ''
            for ordinal, (chunk_id, content) in enumerate(zip(chunk_ids, chunks, strict=True)):
                connection.execute(
                    'INSERT INTO chunks (id, document_id, ordinal, content, created_at) VALUES (?, ?, ?, ?, ?)',
                    (chunk_id, document_id, ordinal, content, now),
                )
                connection.execute(
                    'INSERT INTO chunks_fts (chunk_id, document_id, title, content) VALUES (?, ?, ?, ?)',
                    (chunk_id, document_id, self._fts_index_text(title), self._fts_index_text(content)),
                )
        return chunk_ids

    def chunk_ids(self, document_id: str) -> list[str]:
        with self._connect() as connection:
            rows = connection.execute(
                'SELECT id FROM chunks WHERE document_id = ? ORDER BY ordinal', (document_id,)
            ).fetchall()
        return [str(row['id']) for row in rows]

    def delete_document(self, document_id: str) -> list[str]:
        with self._connect() as connection:
            old_ids = [row['id'] for row in connection.execute('SELECT id FROM chunks WHERE document_id = ?', (document_id,))]
            connection.execute('DELETE FROM chunks_fts WHERE document_id = ?', (document_id,))
            connection.execute('DELETE FROM documents WHERE id = ?', (document_id,))
        return old_ids

    def get_chunks(self, chunk_ids: list[str]) -> list[StoredChunk]:
        if not chunk_ids:
            return []
        placeholders = ','.join('?' for _ in chunk_ids)
        query = f'''
            SELECT chunks.id, chunks.document_id, chunks.ordinal, chunks.content,
                   documents.source_type, documents.source_id, documents.title, documents.url, documents.tags_json
            FROM chunks JOIN documents ON documents.id = chunks.document_id
            WHERE chunks.id IN ({placeholders})
        '''
        with self._connect() as connection:
            rows = connection.execute(query, chunk_ids).fetchall()
        by_id = {row['id']: self._row_to_chunk(row) for row in rows}
        return [by_id[chunk_id] for chunk_id in chunk_ids if chunk_id in by_id]

    def keyword_search(self, query: str, limit: int) -> list[StoredChunk]:
        fts_query = self._fts_query(query)
        if not fts_query:
            return []
        statement = '''
            SELECT chunks.id, chunks.document_id, chunks.ordinal, chunks.content,
                   documents.source_type, documents.source_id, documents.title, documents.url, documents.tags_json,
                   bm25(chunks_fts) AS rank
            FROM chunks_fts
            JOIN chunks ON chunks.id = chunks_fts.chunk_id
            JOIN documents ON documents.id = chunks.document_id
            WHERE chunks_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        '''
        with self._connect() as connection:
            rows = connection.execute(statement, (fts_query, limit)).fetchall()
        return [self._row_to_chunk(row) for row in rows]

    def stats(self) -> dict[str, int]:
        with self._connect() as connection:
            documents = connection.execute('SELECT COUNT(*) FROM documents').fetchone()[0]
            chunks = connection.execute('SELECT COUNT(*) FROM chunks').fetchone()[0]
        return {'documents': documents, 'chunks': chunks}

    @staticmethod
    def _fts_query(query: str) -> str:
        """Build a MATCH expression from an allow-listed token set only.

        The query is still supplied to SQLite as a bound parameter, but FTS5
        parses MATCH's mini-language after binding.  Never interpolate user
        punctuation into that language: preserve only bounded Latin/digit
        tokens and individual Han characters, then add the fixed syntax here.
        """
        reserved = {'AND', 'OR', 'NOT', 'NEAR'}
        latin_tokens = [
            token for token in re.findall(r'[A-Za-z0-9]{1,64}', query.upper())
            if token not in reserved
        ]
        cjk_tokens = re.findall(r'[\u4e00-\u9fff]', query)
        tokens = (latin_tokens + cjk_tokens)[:16]
        return ' OR '.join(f'"{token}"*' for token in tokens)

    @staticmethod
    def _fts_index_text(value: str) -> str:
        cjk_characters = re.findall(r'[\u4e00-\u9fff]', value)
        return f'{value}\n{" ".join(cjk_characters)}' if cjk_characters else value

    @staticmethod
    def _row_to_chunk(row: sqlite3.Row) -> StoredChunk:
        try:
            tags = json.loads(row['tags_json'])
        except (TypeError, json.JSONDecodeError):
            tags = []
        return StoredChunk(
            id=row['id'], document_id=row['document_id'], ordinal=row['ordinal'], content=row['content'],
            source_type=row['source_type'], source_id=row['source_id'], title=row['title'], url=row['url'],
            tags=tags if isinstance(tags, list) else [],
        )
