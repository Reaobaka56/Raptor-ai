import os
import re
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque, Dict, Iterable, Optional, Pattern, Tuple

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


@dataclass(frozen=True)
class RateLimitRule:
    """Single per-client request limit for matching request paths."""

    name: str
    max_requests: int
    window_seconds: int
    path_prefix: Optional[str] = None
    path_regex: Optional[Pattern[str]] = None

    def matches(self, path: str) -> bool:
        if self.path_prefix and path.startswith(self.path_prefix):
            return True
        if self.path_regex and self.path_regex.match(path):
            return True
        return False


def _int_from_env(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except ValueError:
        return default


def build_rate_limit_rules() -> Tuple[RateLimitRule, ...]:
    """Build ordered rate-limit rules from environment-backed defaults."""
    return (
        RateLimitRule(
            name="scan",
            path_prefix="/api/scan",
            max_requests=_int_from_env("RATE_LIMIT_SCAN_MAX", 10),
            window_seconds=_int_from_env("RATE_LIMIT_SCAN_WINDOW_SECONDS", 3600),
        ),
        RateLimitRule(
            name="fix_pr",
            path_regex=re.compile(r"^/api/reviews/\d+/pull-request$"),
            max_requests=_int_from_env("RATE_LIMIT_FIX_PR_MAX", 5),
            window_seconds=_int_from_env("RATE_LIMIT_FIX_PR_WINDOW_SECONDS", 3600),
        ),
        RateLimitRule(
            name="debug_solve",
            path_prefix="/debug/solve",
            max_requests=_int_from_env("RATE_LIMIT_DEBUG_MAX", 20),
            window_seconds=_int_from_env("RATE_LIMIT_DEBUG_WINDOW_SECONDS", 3600),
        ),
        RateLimitRule(
            name="memory_search",
            path_prefix="/api/memory/similar",
            max_requests=_int_from_env("RATE_LIMIT_MEMORY_SEARCH_MAX", 30),
            window_seconds=_int_from_env("RATE_LIMIT_MEMORY_SEARCH_WINDOW_SECONDS", 3600),
        ),
        RateLimitRule(
            name="onboarding",
            path_prefix="/api/memory/onboarding/",
            max_requests=_int_from_env("RATE_LIMIT_ONBOARDING_MAX", 30),
            window_seconds=_int_from_env("RATE_LIMIT_ONBOARDING_WINDOW_SECONDS", 3600),
        ),
        RateLimitRule(
            name="auth",
            path_prefix="/api/auth/",
            max_requests=_int_from_env("RATE_LIMIT_AUTH_MAX", 20),
            window_seconds=_int_from_env("RATE_LIMIT_AUTH_WINDOW_SECONDS", 900),
        ),
        RateLimitRule(
            name="global",
            max_requests=_int_from_env("RATE_LIMIT_GLOBAL_MAX", 300),
            window_seconds=_int_from_env("RATE_LIMIT_GLOBAL_WINDOW_SECONDS", 900),
        ),
    )


class InMemoryRateLimitMiddleware(BaseHTTPMiddleware):
    """Small in-process fixed-window limiter for every FastAPI route."""

    def __init__(self, app, rules: Iterable[RateLimitRule]):
        super().__init__(app)
        self.rules = tuple(rules)
        self.hits: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)
        self.lock = threading.RLock()

    async def dispatch(self, request: Request, call_next) -> Response:
        rule = self._rule_for_path(request.url.path)
        client_key = self._client_key(request)
        now = time.monotonic()

        allowed, remaining, reset_seconds = self._record_hit(rule, client_key, now)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Please retry after the reset window.",
                    "limit": rule.max_requests,
                    "windowSeconds": rule.window_seconds,
                    "retryAfterSeconds": reset_seconds,
                },
                headers=self._headers(rule, remaining=0, reset_seconds=reset_seconds, retry_after=reset_seconds),
            )

        response = await call_next(request)
        response.headers.update(self._headers(rule, remaining=remaining, reset_seconds=reset_seconds))
        return response

    def _rule_for_path(self, path: str) -> RateLimitRule:
        for rule in self.rules:
            if rule.matches(path) or rule.name == "global":
                return rule
        return self.rules[-1]

    def _client_key(self, request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",", 1)[0].strip()
        if request.client and request.client.host:
            return request.client.host
        return "unknown"

    def _record_hit(self, rule: RateLimitRule, client_key: str, now: float) -> Tuple[bool, int, int]:
        bucket_key = (rule.name, client_key)
        window_start = now - rule.window_seconds
        with self.lock:
            bucket = self.hits[bucket_key]
            while bucket and bucket[0] <= window_start:
                bucket.popleft()

            if len(bucket) >= rule.max_requests:
                reset_seconds = max(1, int(bucket[0] + rule.window_seconds - now))
                return False, 0, reset_seconds

            bucket.append(now)
            remaining = max(0, rule.max_requests - len(bucket))
            reset_seconds = max(1, int(bucket[0] + rule.window_seconds - now))
            return True, remaining, reset_seconds

    def _headers(
        self,
        rule: RateLimitRule,
        remaining: int,
        reset_seconds: int,
        retry_after: Optional[int] = None,
    ) -> Dict[str, str]:
        headers = {
            "X-RateLimit-Limit": str(rule.max_requests),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(reset_seconds),
            "X-RateLimit-Window": str(rule.window_seconds),
            "X-RateLimit-Policy": rule.name,
        }
        if retry_after is not None:
            headers["Retry-After"] = str(retry_after)
        return headers
