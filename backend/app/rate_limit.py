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

ADMIN_USERNAMES = {"reaobaka56"}
PREMIUM_MULTIPLIER = 10   # premium users get 10x limits


@dataclass(frozen=True)
class RateLimitRule:
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


def _extract_username_from_request(request: Request) -> Optional[str]:
    """
    Extract the authenticated username from the Bearer token in the request.
    Used to grant admin/premium bypass before hitting the rate limiter.
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]
    if not token:
        return None
    try:
        # Import here to avoid circular import
        from .services.session_store import get_session
        session = get_session(token)
        if session:
            return session.get("user", {}).get("username")
    except Exception:
        pass
    return None


class InMemoryRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Per-client fixed-window rate limiter.
    
    Tiers:
    - Admin/premium accounts (reaobaka56): unlimited — all limits bypassed
    - Regular users: standard limits from env vars
    """

    def __init__(self, app, rules: Iterable[RateLimitRule]):
        super().__init__(app)
        self.rules = tuple(rules)
        self.hits: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)
        self.lock = threading.RLock()

    async def dispatch(self, request: Request, call_next) -> Response:
        # Check for admin/premium bypass FIRST
        username = _extract_username_from_request(request)
        if username and username.lower() in ADMIN_USERNAMES:
            # Premium/admin — no rate limiting at all
            return await call_next(request)

        rule = self._rule_for_path(request.url.path)
        client_key = self._client_key(request)
        now = time.monotonic()

        allowed, remaining, reset_seconds = self._record_hit(rule, client_key, now)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Upgrade to premium for unlimited access.",
                    "limit": rule.max_requests,
                    "windowSeconds": rule.window_seconds,
                    "retryAfterSeconds": reset_seconds,
                    "upgradeUrl": "/pricing",
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
        trusted = os.getenv("TRUSTED_PROXY_IPS", "")
        trusted_set = {p.strip() for p in trusted.split(",") if p.strip()}
        peer = request.client.host if request.client and request.client.host else None
        if forwarded_for and peer and peer in trusted_set:
            return forwarded_for.split(",", 1)[0].strip()
        if peer:
            return peer
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

    def _headers(self, rule, remaining, reset_seconds, retry_after=None):
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
