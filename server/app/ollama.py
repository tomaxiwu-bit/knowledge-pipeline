from __future__ import annotations

from typing import Any

import httpx


class OllamaUnavailable(RuntimeError):
    pass


class OllamaClient:
    def __init__(self, base_url: str, embed_model: str, chat_model: str, timeout_seconds: float) -> None:
        self.base_url = base_url.rstrip('/')
        self.embed_model = embed_model
        self.chat_model = chat_model
        self.timeout = timeout_seconds

    async def embeddings(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        payload = {'model': self.embed_model, 'input': texts, 'truncate': True}
        data = await self._post('/api/embed', payload)
        embeddings = data.get('embeddings')
        if not isinstance(embeddings, list) or len(embeddings) != len(texts):
            raise OllamaUnavailable('Ollama returned an invalid embedding response')
        return [[float(value) for value in embedding] for embedding in embeddings]

    async def chat(self, messages: list[dict[str, str]]) -> str:
        data = await self._post('/api/chat', {'model': self.chat_model, 'stream': False, 'messages': messages})
        message = data.get('message')
        content = message.get('content') if isinstance(message, dict) else None
        if not isinstance(content, str) or not content.strip():
            raise OllamaUnavailable('Ollama returned an empty chat response')
        return content.strip()

    async def _post(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f'{self.base_url}{endpoint}', json=payload)
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, dict):
                    raise OllamaUnavailable('Ollama returned an invalid response')
                return data
        except (httpx.HTTPError, ValueError) as error:
            raise OllamaUnavailable(f'Ollama is unavailable at {self.base_url}: {error}') from error
