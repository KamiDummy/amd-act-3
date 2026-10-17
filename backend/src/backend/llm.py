"""Chat client for AMD Token Factory, an OpenAI-compatible LLM API.

Docs: https://developer.amd.com.cn/radeon/api. The whole team shares one key and its
rate limits (about 20 requests a minute), so features should make few, large calls.
"""

import json
import re
from functools import lru_cache
from typing import Any

from fastapi import HTTPException, status
from openai import OpenAI, OpenAIError

from backend.config import settings

# The SDK retries 429s and 5xx with exponential backoff and honours Retry-After.
MAX_RETRIES = 3
TIMEOUT_SECONDS = 180
# Some models wrap JSON in a Markdown code fence even in JSON mode.
CODE_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)


class LlmError(Exception):
    """The LLM call failed or returned something unusable. Safe to show to the user."""


class LlmClient:
    def __init__(self, client: OpenAI, model: str) -> None:
        self._client = client
        self.model = model

    def complete_json(self, system: str, user: str, *, max_tokens: int) -> dict[str, Any]:
        """Sends one system and one user message and returns the reply parsed as a JSON object."""
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                # Gemma expects the system message first; this shape works on every model.
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=max_tokens,
            )
        except OpenAIError as exc:
            raise LlmError("The language model could not be reached. Try again later.") from exc

        choice = response.choices[0]
        if choice.finish_reason == "length":
            raise LlmError("The language model's answer was cut off.")
        content = (choice.message.content or "").strip()
        if match := CODE_FENCE.match(content):
            content = match.group(1)
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            raise LlmError("The language model returned invalid JSON.") from exc
        if not isinstance(data, dict):
            raise LlmError("The language model returned invalid JSON.")
        return data


@lru_cache
def _client() -> LlmClient:
    api_key = settings.token_factory_api_key.get_secret_value()  # type: ignore[union-attr]
    openai = OpenAI(
        base_url=settings.token_factory_base_url,
        api_key=api_key,
        max_retries=MAX_RETRIES,
        timeout=TIMEOUT_SECONDS,
    )
    return LlmClient(openai, settings.token_factory_model)


def get_llm() -> LlmClient:
    """Dependency for routes that need the LLM. 503 when no API key is configured."""
    if not settings.llm_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The language model is not configured on the server.",
        )
    return _client()
