"""Single entry point for every LLM call (syllabus parsing, topic mapping,
encouragement messages, question drafts).

Capstone §3.9.2 mitigations implemented here:
  * Inconsistent Output -> JSON responses are cached in PostgreSQL (llm_cache),
    keyed by model + prompt, so identical prompts return the identical answer.
  * API Dependency -> transient errors are retried with backoff, and a circuit
    breaker stops calling a failing provider for a cool-down period so requests
    fail fast and fall back (graceful degradation) instead of hanging.
Callers handle LLMUnavailable by falling back (rule-based parser, manual review
queue, template drafts, or no encouragement message).
"""
import hashlib
import json
import logging
import threading
import time
from datetime import datetime, timezone

from backend.core.config import settings
from backend.core.database import SessionLocal

logger = logging.getLogger(__name__)

# Patched in tests to point the cache at the test database.
_session_factory = SessionLocal
_openai_client = None


class LLMUnavailable(Exception):
    """No configured provider could answer."""


class CircuitBreaker:
    """Opens after `threshold` consecutive failures; while open, calls are refused
    for `cooldown` seconds, then one trial call is let through (half-open)."""

    def __init__(self, name: str, threshold: int = 3, cooldown: float = 60.0, clock=time.monotonic):
        self.name = name
        self.threshold = threshold
        self.cooldown = cooldown
        self._clock = clock
        self._lock = threading.Lock()
        self.failures = 0
        self.opened_at: float | None = None

    def allow(self) -> bool:
        with self._lock:
            return self.opened_at is None or self._clock() - self.opened_at >= self.cooldown

    def record_success(self) -> None:
        with self._lock:
            self.failures = 0
            self.opened_at = None

    def record_failure(self) -> None:
        with self._lock:
            self.failures += 1
            if self.failures >= self.threshold:
                self.opened_at = self._clock()
                logger.warning("LLM circuit '%s' opened after %d failures", self.name, self.failures)

    def status(self) -> str:
        with self._lock:
            if self.opened_at is None:
                return "closed"
            return "open" if self._clock() - self.opened_at < self.cooldown else "half_open"


breakers = {"openai": CircuitBreaker("openai")}

RETRY_DELAYS = (0.5,)  # one retry after 0.5 s; patched to () in tests
_sleep = time.sleep


def _is_transient(exc: Exception) -> bool:
    try:
        import openai
        transient = (openai.APIConnectionError, openai.APITimeoutError,
                     openai.RateLimitError, openai.InternalServerError)
    except Exception:  # pragma: no cover - openai always installed
        transient = ()
    return isinstance(exc, transient) or isinstance(exc, (TimeoutError, ConnectionError))


def _call(provider: str, fn):
    """Run fn() through the provider's circuit breaker with retries on transient errors."""
    breaker = breakers[provider]
    if not breaker.allow():
        raise LLMUnavailable(f"{provider} circuit open")
    attempts = len(RETRY_DELAYS) + 1
    for attempt in range(attempts):
        try:
            result = fn()
        except json.JSONDecodeError as exc:
            # Bad output, not an outage: don't trip the breaker.
            raise LLMUnavailable(f"{provider} returned invalid JSON") from exc
        except Exception as exc:
            if attempt < attempts - 1 and _is_transient(exc):
                _sleep(RETRY_DELAYS[attempt])
                continue
            breaker.record_failure()
            raise LLMUnavailable(f"{provider}: {exc}") from exc
        breaker.record_success()
        return result


def llm_status() -> dict:
    """Provider status for /health and the UI's "AI temporarily unavailable" banner."""
    providers = {}
    if openai_configured():
        providers["openai"] = breakers["openai"].status()
    available = any(state != "open" for state in providers.values())
    return {"configured": bool(providers), "available": available, "providers": providers}


def openai_configured() -> bool:
    key = settings.openai_api_key or ""
    return bool(key) and not key.startswith("placeholder") and not key.startswith("sk-test")


def llm_configured() -> bool:
    return openai_configured()


def _client():
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI
        _openai_client = OpenAI(api_key=settings.openai_api_key, timeout=30.0, max_retries=0)
    return _openai_client


def _cache_key(model: str, prompt: str, temperature: float) -> str:
    return hashlib.sha256(f"{model}\n{temperature}\n{prompt}".encode()).hexdigest()


def _cache_get(key: str) -> dict | None:
    from backend.models.llm_cache import LLMCache
    try:
        with _session_factory() as db:
            row = db.query(LLMCache).filter(LLMCache.cache_key == key).first()
            if row is None:
                return None
            row.hit_count = (row.hit_count or 0) + 1
            row.last_hit_at = datetime.now(timezone.utc)
            db.commit()
            return json.loads(row.response)
    except Exception as exc:  # cache trouble must never break the AI path
        logger.warning("LLM cache read failed: %s", exc)
        return None


def _cache_put(key: str, purpose: str, model: str, provider: str, result: dict) -> None:
    from backend.models.llm_cache import LLMCache
    try:
        with _session_factory() as db:
            if db.query(LLMCache).filter(LLMCache.cache_key == key).first() is None:
                db.add(LLMCache(cache_key=key, purpose=purpose, model=model, provider=provider,
                                response=json.dumps(result)))
                db.commit()
    except Exception as exc:
        logger.warning("LLM cache write failed: %s", exc)


def _openai_json(prompt: str, temperature: float) -> dict:
    response = _client().chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


def _openai_text(prompt: str, temperature: float, max_tokens: int) -> str:
    response = _client().chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content.strip()


def complete_json(prompt: str, *, purpose: str, temperature: float = 0.0, use_cache: bool = True) -> dict:
    """Return the model's JSON answer for prompt, from cache when available."""
    if not llm_configured():
        raise LLMUnavailable("No LLM provider configured")
    key = _cache_key(settings.openai_model, prompt, temperature)
    if use_cache:
        cached = _cache_get(key)
        if cached is not None:
            return cached
    result = _call("openai", lambda: _openai_json(prompt, temperature))
    if use_cache:
        _cache_put(key, purpose, settings.openai_model, "openai", result)
    return result


def complete_text(prompt: str, *, purpose: str, temperature: float = 0.7, max_tokens: int = 80) -> str:
    """Free-text completion (not cached: used for varied encouragement messages)."""
    if not llm_configured():
        raise LLMUnavailable("No LLM provider configured")
    return _call("openai", lambda: _openai_text(prompt, temperature, max_tokens))
