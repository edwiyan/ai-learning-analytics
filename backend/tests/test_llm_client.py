"""
Shared LLM client (capstone §3.9.2): deterministic response cache.
"""
import pytest

from backend.models.llm_cache import LLMCache
from backend.services.ai import llm_client
from backend.tests.conftest import _TestingSessionLocal


@pytest.fixture
def llm(db, monkeypatch):
    """LLM 'configured', cache pointed at the test DB, provider calls counted."""
    calls = []
    monkeypatch.setattr(llm_client, "_session_factory", _TestingSessionLocal)
    monkeypatch.setattr(llm_client, "openai_configured", lambda: True)

    def fake_openai(prompt, temperature):
        calls.append(prompt)
        return {"answer": len(calls)}
    monkeypatch.setattr(llm_client, "_openai_json", fake_openai)
    return calls


def test_identical_prompt_is_served_from_cache(db, llm):
    first = llm_client.complete_json("map this", purpose="topic_mapping")
    second = llm_client.complete_json("map this", purpose="topic_mapping")
    assert first == second == {"answer": 1}
    assert len(llm) == 1

    row = db.query(LLMCache).one()
    assert row.purpose == "topic_mapping" and row.provider == "openai"
    db.refresh(row)
    assert row.hit_count == 1


def test_different_prompt_or_no_cache_calls_provider(db, llm):
    llm_client.complete_json("a", purpose="x")
    llm_client.complete_json("b", purpose="x")
    llm_client.complete_json("a", purpose="x", use_cache=False)
    assert len(llm) == 3


def test_unconfigured_raises(monkeypatch):
    monkeypatch.setattr(llm_client, "llm_configured", lambda: False)
    with pytest.raises(llm_client.LLMUnavailable):
        llm_client.complete_json("x", purpose="x")


def test_provider_error_becomes_llm_unavailable(db, llm, monkeypatch):
    def boom(prompt, temperature):
        raise RuntimeError("500 from provider")
    monkeypatch.setattr(llm_client, "_openai_json", boom)
    with pytest.raises(llm_client.LLMUnavailable):
        llm_client.complete_json("y", purpose="x")
