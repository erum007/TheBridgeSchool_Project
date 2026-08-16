from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock
from time import monotonic

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response


@dataclass(frozen=True, slots=True)
class RateLimit:
    bucket: str
    requests: int
    window_seconds: int = 60


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-client rate limits grouped by API service."""

    _SAFE_METHODS = {"GET", "HEAD"}
    _EXEMPT_PATHS = {"/api/health"}

    def __init__(self, app, enabled: bool = True) -> None:
        super().__init__(app)
        self.enabled = enabled
        self._requests: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = Lock()
        self._checks = 0

    @staticmethod
    def _client_key(request: Request) -> str:
        # X-Forwarded-For is intentionally not trusted unless trusted proxy
        # middleware is configured by the deployment.
        return request.client.host if request.client else "unknown"

    @classmethod
    def _limit_for(cls, request: Request) -> RateLimit:
        path = request.url.path.rstrip("/") or "/"
        if path == "/api/auth/login" or "password" in path or "change-email" in path:
            return RateLimit("authentication-sensitive", 5)
        if path.endswith(("/summarise", "/summarize", "/ai-workspace")):
            return RateLimit("ai", 5)
        if path in {"/api/emails/send", "/api/emails/test"}:
            return RateLimit("email-delivery", 10)
        if path.endswith("/send-reminder-now"):
            return RateLimit("email-reminders", 10)
        if path == "/api/push/test":
            return RateLimit("push-delivery", 10)
        if path in {"/api/results/upload", "/api/users/import", "/api/upload-image", "/api/upload-email-document"}:
            return RateLimit("uploads", 10)

        parts = path.split("/")
        service = parts[2] if len(parts) > 2 and parts[1] == "api" else "api"
        operation = "read" if request.method in cls._SAFE_METHODS else "write"
        return RateLimit(f"{service}:{operation}", 120 if operation == "read" else 30)

    def _consume(self, client: str, limit: RateLimit, now: float) -> tuple[bool, int, int]:
        key = (client, limit.bucket)
        cutoff = now - limit.window_seconds
        with self._lock:
            timestamps = self._requests[key]
            while timestamps and timestamps[0] <= cutoff:
                timestamps.popleft()
            if len(timestamps) >= limit.requests:
                retry_after = max(1, int(timestamps[0] + limit.window_seconds - now) + 1)
                return False, 0, retry_after

            timestamps.append(now)
            remaining = limit.requests - len(timestamps)
            self._checks += 1
            if self._checks % 1000 == 0:
                stale = [item for item, values in self._requests.items() if not values or values[-1] <= cutoff]
                for item in stale:
                    self._requests.pop(item, None)
        return True, remaining, limit.window_seconds

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if (
            not self.enabled
            or not request.url.path.startswith("/api/")
            or request.method == "OPTIONS"
            or request.url.path in self._EXEMPT_PATHS
        ):
            return await call_next(request)

        limit = self._limit_for(request)
        allowed, remaining, reset_or_retry = self._consume(
            self._client_key(request), limit, monotonic()
        )
        headers = {
            "X-RateLimit-Limit": str(limit.requests),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(reset_or_retry),
        }
        if not allowed:
            headers["Retry-After"] = str(reset_or_retry)
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
                headers=headers,
            )

        response = await call_next(request)
        response.headers.update(headers)
        return response
