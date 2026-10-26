"""Single entry point for every LLM call (syllabus parsing, topic mapping,
encouragement messages, question drafts).

Capstone §3.9.2 mitigations implemented here:
  * Inconsistent Output -> JSON responses are cached in PostgreSQL (llm_cache),
    keyed by model + prompt, so identical prompts return the identical answer.
  * API Dependency -> transient errors are retried with backoff, and a circuit
    breaker stops calling a failing provider for a cool-down period so requests
    fail fast and fall back (graceful degradation) instead of hanging.
  * Multi-provider fallback -> when OpenAI fails (or its circuit is open) and
    GEMINI_ENABLED=true with GEMINI_API_KEY set, the same prompt goes to Google Gemini.
  * Data minimization (panel comment 6) -> every prompt passes a guard that blocks
    student numbers and student names and strips email addresses; OpenAI calls are
    sent with store=False. Student scores are never part of any prompt.
Callers handle LLMUnavailable by falling back (rule-based parser, manual review
queue, template drafts, or no encouragement message).
"""
import hashlib
import json
import logging
import re
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


breakers = {"openai": CircuitBreaker("openai"), "gemini": CircuitBreaker("gemini")}

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
    if gemini_configured():
        providers["gemini"] = breakers["gemini"].status()
    available = any(state != "open" for state in providers.values())
    return {
        "configured": bool(providers),
        "available": available,
        "providers": providers,
        # What leaves the server and under which settings (shown to administrators).
        "data_handling": {
            "openai_store": False,
            "gemini_fallback_enabled": gemini_configured(),
            "student_data_sent": False,
            "sent": "syllabus text (contact details removed), question text, competency and outcome text, "
                    "resource titles",
        },
    }


def openai_configured() -> bool:
    key = settings.openai_api_key or ""
    return bool(key) and not key.startswith("placeholder") and not key.startswith("sk-test")


def gemini_configured() -> bool:
    return bool(settings.gemini_enabled and settings.gemini_api_key)


def llm_configured() -> bool:
    return openai_configured() or gemini_configured()


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
        store=False,
    )
    return json.loads(response.choices[0].message.content)


def _openai_text(prompt: str, temperature: float, max_tokens: int) -> str:
    response = _client().chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_tokens,
        store=False,
    )
    return response.choices[0].message.content.strip()


GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _gemini_generate(prompt: str, generation_config: dict) -> str:
    import httpx
    response = httpx.post(
        GEMINI_URL.format(model=settings.gemini_model),
        headers={"x-goog-api-key": settings.gemini_api_key},
        json={"contents": [{"role": "user", "parts": [{"text": prompt}]}],
              "generationConfig": generation_config},
        timeout=30.0,
    )
    if response.status_code == 429 or response.status_code >= 500:
        raise ConnectionError(f"Gemini HTTP {response.status_code}")  # transient: retried
    response.raise_for_status()
    return response.json()["candidates"][0]["content"]["parts"][0]["text"]


def _gemini_json(prompt: str, temperature: float) -> dict:
    return json.loads(_gemini_generate(
        prompt, {"temperature": temperature, "responseMimeType": "application/json"}))


def _gemini_text(prompt: str, temperature: float, max_tokens: int) -> str:
    return _gemini_generate(prompt, {"temperature": temperature, "maxOutputTokens": max_tokens}).strip()


def _providers() -> list[tuple[str, str]]:
    """(provider, model) in fallback order, configured ones only."""
    order = []
    if openai_configured():
        order.append(("openai", settings.openai_model))
    if gemini_configured():
        order.append(("gemini", settings.gemini_model))
    return order


def _json_fn(provider: str):
    return _openai_json if provider == "openai" else _gemini_json


def _text_fn(provider: str):
    return _openai_text if provider == "openai" else _gemini_text


class PromptBlocked(LLMUnavailable):
    """A prompt contained student-identifying data and was not sent."""


_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
_identifiers_cache: dict = {"at": 0.0, "numbers": set(), "names": set()}
IDENTIFIER_CACHE_SECONDS = 300


def _student_identifiers() -> tuple[set, set]:
    """Student numbers and full names (lowercased), refreshed every few minutes."""
    now = time.monotonic()
    if now - _identifiers_cache["at"] > IDENTIFIER_CACHE_SECONDS:
        numbers, names = set(), set()
        try:
            from backend.models.user import User, UserRole
            db = _session_factory()
            try:
                for number, name in db.query(User.student_number, User.full_name).filter(
                        User.role == UserRole.student).all():
                    if number:
                        numbers.add(number.strip().lower())
                    if name and len(name.split()) >= 2:
                        names.add(" ".join(name.lower().split()))
            finally:
                db.close()
        except Exception as exc:  # DB unavailable: emails are still stripped
            logger.warning("Prompt guard could not load student identifiers: %s", exc)
        _identifiers_cache.update(at=now, numbers=numbers, names=names)
    return _identifiers_cache["numbers"], _identifiers_cache["names"]


def guard_prompt(prompt: str, purpose: str) -> str:
    """Strip email addresses and refuse prompts that contain a student number or a
    student's full name. Returns the prompt to send."""
    prompt = _EMAIL.sub("[email removed]", prompt)
    lowered = " ".join(prompt.lower().split())
    numbers, names = _student_identifiers()
    hit = next((n for n in numbers if re.search(rf"(?<![\w-]){re.escape(n)}(?![\w-])", lowered)), None) \
        or next((n for n in names if re.search(rf"\b{re.escape(n)}\b", lowered)), None)
    if hit:
        logger.error("Blocked %s prompt: it contained a student identifier", purpose)
        raise PromptBlocked(f"{purpose} prompt blocked: it contained student-identifying data")
    return prompt


def complete_json(prompt: str, *, purpose: str, temperature: float = 0.0, use_cache: bool = True) -> dict:
    """Return the model's JSON answer for prompt, from cache when available,
    trying each configured provider in order."""
    providers = _providers()
    if not providers:
        raise LLMUnavailable("No LLM provider configured")
    prompt = guard_prompt(prompt, purpose)
    # Keyed on the primary model so a fallback answer is reused once OpenAI recovers.
    key = _cache_key(providers[0][1], prompt, temperature)
    if use_cache:
        cached = _cache_get(key)
        if cached is not None:
            return cached
    errors = []
    for provider, model in providers:
        fn = _json_fn(provider)
        try:
            result = _call(provider, lambda: fn(prompt, temperature))
        except LLMUnavailable as exc:
            errors.append(str(exc))
            continue
        if provider != providers[0][0]:
            logger.info("LLM fallback: %s answered %s", provider, purpose)
        if use_cache:
            _cache_put(key, purpose, model, provider, result)
        return result
    raise LLMUnavailable("; ".join(errors))


def complete_text(prompt: str, *, purpose: str, temperature: float = 0.7, max_tokens: int = 80) -> str:
    """Free-text completion (not cached: used for varied encouragement messages)."""
    providers = _providers()
    if not providers:
        raise LLMUnavailable("No LLM provider configured")
    prompt = guard_prompt(prompt, purpose)
    errors = []
    for provider, _model in providers:
        fn = _text_fn(provider)
        try:
            return _call(provider, lambda: fn(prompt, temperature, max_tokens))
        except LLMUnavailable as exc:
            errors.append(str(exc))
    raise LLMUnavailable("; ".join(errors))
