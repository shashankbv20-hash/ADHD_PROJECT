"""Baseline production hardening as a pure ASGI middleware.

* **Security headers** on every response (no sniffing, no framing, no referrer, no caching of
  API data); HSTS only in the ``production`` environment, where the service sits behind TLS.
* **Request size limit**: bodies over ``max_request_bytes`` are refused with 413 before they are
  processed, whether the size is declared (Content-Length) or discovered while streaming.
* **Rate limiting**: a sliding window per authenticated caller (hashed bearer token) and per client
  address. Health checks and CORS preflights are exempt.

The limiter is in-process, so each instance counts separately. That is a safety net against
runaway clients and cheap abuse, not a substitute for an edge limiter (for example Cloud Armor or
a gateway) when running more than one instance; see docs/deployment.md.
"""

from __future__ import annotations

import hashlib
import json
import math
import time
from collections import deque
from collections.abc import Callable
from uuid import uuid4

from starlette.types import ASGIApp, Message, Receive, Scope, Send

EXEMPT_PATH_PREFIXES = ("/health",)

SECURITY_HEADERS: tuple[tuple[bytes, bytes], ...] = (
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"no-referrer"),
    (b"x-frame-options", b"DENY"),
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
    (b"cross-origin-resource-policy", b"same-site"),
)
HSTS = (b"strict-transport-security", b"max-age=31536000; includeSubDomains")


class SlidingWindowLimiter:
    """Allow at most ``limit`` events per ``window`` seconds for each key."""

    def __init__(
        self,
        limit: int,
        window: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
        max_keys: int = 10_000,
    ) -> None:
        self.limit = limit
        self.window = window
        self.clock = clock
        self.max_keys = max_keys
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str) -> tuple[bool, float]:
        """Record an attempt. Returns ``(allowed, retry_after_seconds)``."""
        now = self.clock()
        hits = self._hits.setdefault(key, deque())
        cutoff = now - self.window
        while hits and hits[0] <= cutoff:
            hits.popleft()

        if len(hits) >= self.limit:
            return False, max(hits[0] + self.window - now, 0.0)

        hits.append(now)
        if len(self._hits) > self.max_keys:
            self._sweep(cutoff)
        return True, 0.0

    def _sweep(self, cutoff: float) -> None:
        for key in [key for key, hits in self._hits.items() if not hits or hits[-1] <= cutoff]:
            del self._hits[key]


def _json_error(
    status: int, code: str, message: str, request_id: str
) -> tuple[list[tuple[bytes, bytes]], bytes]:
    body = json.dumps({"error": {"code": code, "message": message, "requestId": request_id}}).encode()
    headers = [
        (b"content-type", b"application/json"),
        (b"content-length", str(len(body)).encode()),
        (b"x-request-id", request_id.encode()),
    ]
    return headers, body


class HardeningMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        *,
        max_request_bytes: int = 262_144,
        rate_limit_per_minute: int = 240,
        rate_limit_ip_per_minute: int = 600,
        trust_proxy_headers: bool = False,
        hsts: bool = False,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.app = app
        self.max_request_bytes = max_request_bytes
        self.trust_proxy_headers = trust_proxy_headers
        self.hsts = hsts
        self.user_limiter = (
            SlidingWindowLimiter(rate_limit_per_minute, clock=clock) if rate_limit_per_minute > 0 else None
        )
        self.ip_limiter = (
            SlidingWindowLimiter(rate_limit_ip_per_minute, clock=clock)
            if rate_limit_ip_per_minute > 0
            else None
        )

    # ---- helpers -------------------------------------------------------------------------------

    def _client_address(self, scope: Scope, headers: dict[bytes, bytes]) -> str:
        if self.trust_proxy_headers:
            # Only enable behind a proxy that overwrites this header; otherwise it is spoofable.
            forwarded = headers.get(b"x-forwarded-for", b"").decode("latin-1").split(",")[0].strip()
            if forwarded:
                return forwarded
        client = scope.get("client")
        return client[0] if client else "unknown"

    @staticmethod
    def _caller_key(headers: dict[bytes, bytes]) -> str | None:
        authorization = headers.get(b"authorization", b"").decode("latin-1")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token.strip():
            return "user:" + hashlib.sha256(token.strip().encode()).hexdigest()[:24]
        return None

    def _with_security_headers(self, message: Message, path: str) -> Message:
        if message["type"] != "http.response.start":
            return message
        headers = list(message.get("headers", []))
        present = {name.lower() for name, _ in headers}
        for name, value in SECURITY_HEADERS:
            if name not in present:
                headers.append((name, value))
        if path.startswith("/api") and b"cache-control" not in present:
            headers.append((b"cache-control", b"no-store"))
        if self.hsts and HSTS[0] not in present:
            headers.append(HSTS)
        return {**message, "headers": headers}

    async def _reject(
        self, send: Send, status: int, code: str, text: str, request_id: str, path: str, extra=()
    ):
        headers, body = _json_error(status, code, text, request_id)
        start = self._with_security_headers(
            {"type": "http.response.start", "status": status, "headers": [*headers, *extra]}, path
        )
        await send(start)
        await send({"type": "http.response.body", "body": body})

    # ---- ASGI ----------------------------------------------------------------------------------

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        headers = dict(scope.get("headers", []))
        request_id = headers.get(b"x-request-id", b"").decode("latin-1")[:64] or str(uuid4())

        async def send_with_headers(message: Message) -> None:
            await send(self._with_security_headers(message, path))

        exempt = scope.get("method") == "OPTIONS" or path.startswith(EXEMPT_PATH_PREFIXES)

        if not exempt:
            checks = []
            if self.ip_limiter:
                checks.append(self.ip_limiter.check("ip:" + self._client_address(scope, headers)))
            caller = self._caller_key(headers)
            if self.user_limiter and caller:
                checks.append(self.user_limiter.check(caller))
            blocked = [retry for allowed, retry in checks if not allowed]
            if blocked:
                retry_after = str(max(1, math.ceil(max(blocked)))).encode()
                await self._reject(
                    send,
                    429,
                    "rate_limited",
                    "Too many requests. Please slow down and try again shortly.",
                    request_id,
                    path,
                    extra=[(b"retry-after", retry_after)],
                )
                return

        declared = headers.get(b"content-length")
        if declared is not None:
            try:
                too_big = int(declared) > self.max_request_bytes
            except ValueError:
                too_big = True
            if too_big:
                await self._reject(
                    send, 413, "request_too_large", "The request body is too large.", request_id, path
                )
                return

        # Streaming bodies (no Content-Length) are counted as they arrive.
        received = 0
        too_large = False

        async def counting_receive() -> Message:
            nonlocal received, too_large
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_request_bytes:
                    too_large = True
                    # Stop feeding the application; it will see a disconnect.
                    return {"type": "http.disconnect"}
            return message

        responded = False

        async def guarded_send(message: Message) -> None:
            nonlocal responded
            if too_large and not responded:
                responded = True
                await self._reject(
                    send, 413, "request_too_large", "The request body is too large.", request_id, path
                )
                return
            if too_large:
                return
            responded = True
            await send_with_headers(message)

        await self.app(scope, counting_receive, guarded_send)
