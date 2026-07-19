from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class TextChunk:
    ordinal: int
    content: str


def normalise_text(text: str) -> str:
    return re.sub(r'\n{3,}', '\n\n', text.replace('\r\n', '\n').replace('\r', '\n')).strip()


def chunk_text(text: str, chunk_size: int = 900, overlap: int = 160) -> list[TextChunk]:
    """Split a document on paragraph/sentence boundaries with bounded overlap.

    The implementation is intentionally dependency-free so ingestion behaviour is
    stable across desktop, Docker, and test environments.
    """
    if chunk_size < 160:
        raise ValueError('chunk_size must be at least 160')
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError('overlap must be non-negative and smaller than chunk_size')

    cleaned = normalise_text(text)
    if not cleaned:
        return []

    paragraphs = [item.strip() for item in re.split(r'\n\s*\n', cleaned) if item.strip()]
    pieces: list[str] = []
    for paragraph in paragraphs:
        if len(paragraph) <= chunk_size:
            pieces.append(paragraph)
            continue
        sentences = re.split(r'(?<=[。！？.!?])\s+', paragraph)
        current = ''
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            if len(sentence) > chunk_size:
                if current:
                    pieces.append(current)
                    current = ''
                for start in range(0, len(sentence), chunk_size - overlap):
                    pieces.append(sentence[start:start + chunk_size])
                continue
            candidate = f'{current} {sentence}'.strip()
            if current and len(candidate) > chunk_size:
                pieces.append(current)
                current = current[-overlap:].strip()
                current = f'{current} {sentence}'.strip()
            else:
                current = candidate
        if current:
            pieces.append(current)

    chunks: list[TextChunk] = []
    current = ''
    for piece in pieces:
        candidate = f'{current}\n\n{piece}'.strip()
        if current and len(candidate) > chunk_size:
            chunks.append(TextChunk(len(chunks), current))
            current = f'{current[-overlap:].strip()}\n\n{piece}'.strip() if overlap else piece
        else:
            current = candidate
    if current:
        chunks.append(TextChunk(len(chunks), current))
    return chunks
