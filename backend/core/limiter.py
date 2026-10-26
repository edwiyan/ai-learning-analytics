import time
from collections import defaultdict
from threading import Lock
from fastapi import Request, HTTPException

# Keep slowapi imports for backward compatibility in main.py
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)


class _InMemoryRateLimiter:
    def __init__(self):
        self._windows: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def check(self, key: str, max_calls: int, window_seconds: int = 60) -> None:
        now = time.monotonic()
        with self._lock:
            window = self._windows[key]
            cutoff = now - window_seconds
            while window and window[0] < cutoff:
                window.pop(0)
            if len(window) >= max_calls:
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded. Please try again later.",
                )
            window.append(now)


_limiter = _InMemoryRateLimiter()


def make_rate_limiter(max_calls: int, window_seconds: int = 60):
    """Returns a callable that enforces a sliding-window rate limit per IP+path."""
    def _dep(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        key = f"{request.url.path}:{ip}"
        _limiter.check(key, max_calls, window_seconds)
    return _dep
