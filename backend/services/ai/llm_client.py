"""Single entry point for every LLM call (syllabus parsing, topic mapping,
encouragement messages, question drafts).

Capstone §3.9.2 mitigations implemented here:
  * Inconsistent Output -> JSON responses are cached in PostgreSQL (llm_cache),
    keyed by model + prompt, so identical prompts return the identical answer.
Callers handle LLMUnavailable by falling back (rule-based parser, manual review
queue, template drafts, or no encouragement message).
"""
import hashlib
import json
import logging
from datetime import datetime, timezone

from backend.core.config import settings
from backend.core.database import SessionLocal

logger = logging.getLogger(__name__)

# Patched in tests to point the cache at the test database.
_session_factory = SessionLocal
_openai_client = None


class LLMUnavailable(Exception):
    """No configured provider could answer."""


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
    try:
        result = _openai_json(prompt, temperature)
    except Exception as exc:
        raise LLMUnavailable(str(exc)) from exc
    if use_cache:
        _cache_put(key, purpose, settings.openai_model, "openai", result)
    return result


def complete_text(prompt: str, *, purpose: str, temperature: float = 0.7, max_tokens: int = 80) -> str:
    """Free-text completion (not cached: used for varied encouragement messages)."""
    if not llm_configured():
        raise LLMUnavailable("No LLM provider configured")
    try:
        return _openai_text(prompt, temperature, max_tokens)
    except Exception as exc:
        raise LLMUnavailable(str(exc)) from exc
