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
    monkeypatch.setattr(llm_client, "breakers", {"openai": llm_client.CircuitBreaker("openai")})
    monkeypatch.setattr(llm_client, "_sleep", lambda s: None)

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


# ── Retry and circuit breaker (§3.9.2 API Dependency) ────────────────────────

@pytest.fixture
def fresh_breaker(monkeypatch):
    now = [0.0]
    breaker = llm_client.CircuitBreaker("openai", threshold=2, cooldown=60, clock=lambda: now[0])
    monkeypatch.setattr(llm_client, "breakers", {"openai": breaker})
    monkeypatch.setattr(llm_client, "_sleep", lambda s: None)
    return breaker, now


def test_transient_error_is_retried(db, llm, monkeypatch, fresh_breaker):
    attempts = []

    def flaky(prompt, temperature):
        attempts.append(1)
        if len(attempts) == 1:
            raise TimeoutError("slow")
        return {"ok": True}
    monkeypatch.setattr(llm_client, "_openai_json", flaky)
    assert llm_client.complete_json("p", purpose="x", use_cache=False) == {"ok": True}
    assert len(attempts) == 2
    assert fresh_breaker[0].status() == "closed"


def test_breaker_opens_then_fails_fast_then_half_opens(db, llm, monkeypatch, fresh_breaker):
    breaker, now = fresh_breaker
    calls = []

    def down(prompt, temperature):
        calls.append(1)
        raise RuntimeError("provider down")
    monkeypatch.setattr(llm_client, "_openai_json", down)

    for _ in range(2):
        with pytest.raises(llm_client.LLMUnavailable):
            llm_client.complete_json("p", purpose="x", use_cache=False)
    assert breaker.status() == "open"
    assert llm_client.llm_status()["available"] is False

    calls.clear()
    with pytest.raises(llm_client.LLMUnavailable, match="circuit open"):
        llm_client.complete_json("p", purpose="x", use_cache=False)
    assert calls == []  # failed fast, provider not called

    now[0] = 61
    assert breaker.status() == "half_open"
    monkeypatch.setattr(llm_client, "_openai_json", lambda p, t: {"ok": 1})
    assert llm_client.complete_json("p", purpose="x", use_cache=False) == {"ok": 1}
    assert breaker.status() == "closed"


def test_health_reports_llm_status(client, monkeypatch):
    monkeypatch.setattr(llm_client, "openai_configured", lambda: True)
    body = client.get("/health").json()
    assert body["llm"]["configured"] is True
    assert body["llm"]["providers"]["openai"] in {"closed", "open", "half_open"}
