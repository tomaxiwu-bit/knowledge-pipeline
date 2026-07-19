from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the local-first RAG service."""

    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    app_name: str = 'Knowledge Pipeline Intelligence Service'
    app_data_dir: Path = Path('./data')
    database_path: Path | None = None
    chroma_path: Path | None = None
    ollama_base_url: str = 'http://127.0.0.1:11434'
    ollama_embed_model: str = 'nomic-embed-text'
    ollama_chat_model: str = 'qwen3:4b'
    reranker_mode: str = 'lexical'
    reranker_model: str = 'BAAI/bge-reranker-base'
    request_timeout_seconds: float = 60.0

    def model_post_init(self, __context: object) -> None:
        self.app_data_dir = self.app_data_dir.expanduser().resolve()
        self.app_data_dir.mkdir(parents=True, exist_ok=True)
        self.database_path = (self.database_path or self.app_data_dir / 'knowledge.sqlite3').expanduser().resolve()
        self.chroma_path = (self.chroma_path or self.app_data_dir / 'chroma').expanduser().resolve()
        self.chroma_path.mkdir(parents=True, exist_ok=True)
        self.ollama_base_url = self.ollama_base_url.rstrip('/')


@lru_cache
def get_settings() -> Settings:
    return Settings()
