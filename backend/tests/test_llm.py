from types import SimpleNamespace

import httpx
import openai
import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from backend.config import Settings, settings
from backend.llm import LlmClient, LlmError, get_llm


class FakeCompletions:
    def __init__(self, content: str | None = None, finish_reason: str = "stop", error=None):
        self.content = content
        self.finish_reason = finish_reason
        self.error = error
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        message = SimpleNamespace(content=self.content)
        choice = SimpleNamespace(message=message, finish_reason=self.finish_reason)
        return SimpleNamespace(choices=[choice])


def make_llm(completions: FakeCompletions) -> LlmClient:
    fake_openai = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    return LlmClient(fake_openai, "Gemma-4-31B-IT")  # type: ignore[arg-type]


def test_complete_json_parses_reply_and_sends_json_mode_request():
    completions = FakeCompletions('{"issues": []}')

    data = make_llm(completions).complete_json("system", "user", max_tokens=100)

    assert data == {"issues": []}
    request = completions.calls[0]
    assert request["model"] == "Gemma-4-31B-IT"
    assert request["messages"][0] == {"role": "system", "content": "system"}
    assert request["messages"][1] == {"role": "user", "content": "user"}
    assert request["response_format"] == {"type": "json_object"}
    assert request["max_tokens"] == 100


def test_complete_json_strips_code_fence():
    llm = make_llm(FakeCompletions('```json\n{"ok": true}\n```'))

    assert llm.complete_json("s", "u", max_tokens=10) == {"ok": True}


@pytest.mark.parametrize("content", ["not json", "[1, 2]", "", None])
def test_complete_json_rejects_non_object_reply(content):
    llm = make_llm(FakeCompletions(content))

    with pytest.raises(LlmError, match="invalid JSON"):
        llm.complete_json("s", "u", max_tokens=10)


def test_complete_json_rejects_truncated_reply():
    llm = make_llm(FakeCompletions('{"issues": [', finish_reason="length"))

    with pytest.raises(LlmError, match="cut off"):
        llm.complete_json("s", "u", max_tokens=10)


def test_complete_json_wraps_api_errors():
    error = openai.APIConnectionError(request=httpx.Request("POST", "https://example.test"))
    llm = make_llm(FakeCompletions(error=error))

    with pytest.raises(LlmError, match="could not be reached"):
        llm.complete_json("s", "u", max_tokens=10)


def test_get_llm_is_503_without_api_key(monkeypatch):
    monkeypatch.setattr(settings, "token_factory_api_key", None)

    with pytest.raises(HTTPException) as excinfo:
        get_llm()

    assert excinfo.value.status_code == 503


@pytest.mark.parametrize(("key", "enabled"), [("", False), ("rc-abc", True)])
def test_llm_enabled_follows_api_key(monkeypatch, key, enabled):
    monkeypatch.setenv("DATABASE_URL", "postgresql://x")
    monkeypatch.setenv("TOKEN_FACTORY_API_KEY", key)

    assert Settings(_env_file=None).llm_enabled is enabled  # type: ignore[call-arg]


def test_get_llm_uses_configured_model(monkeypatch):
    monkeypatch.setattr(settings, "token_factory_api_key", SecretStr("rc-test"))

    assert get_llm().model == settings.token_factory_model
