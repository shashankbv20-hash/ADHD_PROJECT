"""Security headers, request-size limits and rate limiting. All data is synthetic."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.hardening import SlidingWindowLimiter
from app.main import create_app
from app.repositories.firestore import InMemoryRepository
from tests.conftest import fake_token_verifier

AUTH = {"Authorization": "Bearer participant-token"}
OTHER = {"Authorization": "Bearer other-participant-token"}


def _client(**overrides) -> TestClient:
    values = {"rate_limit_per_minute": 0, "rate_limit_ip_per_minute": 0, **overrides}
    settings = Settings(firebase_project_id="test-project", cors_origins="http://localhost:3000", **values)
    app = create_app(settings, token_verifier=fake_token_verifier, repository=InMemoryRepository())
    return TestClient(app)


# ---- Security headers -------------------------------------------------------------------------


def test_every_response_carries_baseline_security_headers():
    with _client() as client:
        for response in (
            client.get("/health/live"),
            client.get("/api/v1/users/me", headers=AUTH),
            client.get("/api/v1/users/me"),  # a 401
            client.get("/no-such-route"),  # a 404
        ):
            assert response.headers["x-content-type-options"] == "nosniff"
            assert response.headers["x-frame-options"] == "DENY"
            assert response.headers["referrer-policy"] == "no-referrer"
            assert "camera=()" in response.headers["permissions-policy"]


def test_api_responses_are_never_cached():
    with _client() as client:
        assert client.get("/api/v1/users/me", headers=AUTH).headers["cache-control"] == "no-store"
        assert client.get("/api/v1/users/me").headers["cache-control"] == "no-store"


def test_hsts_is_sent_only_in_production():
    with _client(environment="production") as production, _client() as development:
        assert "strict-transport-security" in production.get("/health/live").headers
        assert "strict-transport-security" not in development.get("/health/live").headers


# ---- Request size -----------------------------------------------------------------------------


def test_declared_oversize_bodies_are_refused_before_processing():
    with _client(max_request_bytes=1_000) as client:
        response = client.post("/api/v1/subjects", headers=AUTH, content=b"x" * 5_000, params={"unused": "1"})

        assert response.status_code == 413
        assert response.json()["error"]["code"] == "request_too_large"
        assert response.headers["x-content-type-options"] == "nosniff"
        # Nothing was created.
        assert client.get("/api/v1/subjects", headers=AUTH).json()["items"] == []


def test_streamed_oversize_bodies_without_content_length_are_refused():
    def chunks():
        for _ in range(10):
            yield b"x" * 500

    with _client(max_request_bytes=1_000) as client:
        response = client.post("/api/v1/subjects", headers=AUTH, content=chunks())

        assert response.status_code == 413
        assert response.json()["error"]["code"] == "request_too_large"


def test_normal_requests_are_unaffected_by_the_size_limit():
    with _client(max_request_bytes=1_000) as client:
        response = client.post("/api/v1/subjects", headers=AUTH, json={"displayLabel": "ok"})

        assert response.status_code == 201


def test_an_invalid_content_length_is_refused():
    with _client() as client:
        response = client.post(
            "/api/v1/subjects", headers={**AUTH, "Content-Length": "not-a-number"}, content=b"{}"
        )

        assert response.status_code in (400, 413)


# ---- Rate limiting ----------------------------------------------------------------------------


def test_a_caller_over_the_limit_gets_429_with_retry_after():
    with _client(rate_limit_per_minute=3) as client:
        statuses = [client.get("/api/v1/users/me", headers=AUTH).status_code for _ in range(5)]

        assert statuses == [200, 200, 200, 429, 429]
        blocked = client.get("/api/v1/users/me", headers=AUTH)
        assert blocked.json()["error"]["code"] == "rate_limited"
        assert int(blocked.headers["retry-after"]) >= 1
        assert blocked.headers["x-content-type-options"] == "nosniff"


def test_callers_are_limited_independently():
    with _client(rate_limit_per_minute=2) as client:
        for _ in range(3):
            client.get("/api/v1/users/me", headers=AUTH)

        assert client.get("/api/v1/users/me", headers=AUTH).status_code == 429
        assert client.get("/api/v1/users/me", headers=OTHER).status_code == 200


def test_health_checks_and_preflights_are_never_rate_limited():
    with _client(rate_limit_per_minute=1, rate_limit_ip_per_minute=1) as client:
        assert all(client.get("/health/live").status_code == 200 for _ in range(10))
        preflight = {
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        }
        assert all(
            client.options("/api/v1/users/me", headers=preflight).status_code == 200 for _ in range(10)
        )


def test_a_client_address_limit_also_applies_to_unauthenticated_requests():
    with _client(rate_limit_ip_per_minute=3) as client:
        statuses = [client.get("/api/v1/users/me").status_code for _ in range(5)]

        assert statuses == [401, 401, 401, 429, 429]


def test_forwarded_for_is_ignored_unless_the_proxy_is_trusted():
    spoof = {"X-Forwarded-For": "203.0.113.9"}
    with _client(rate_limit_ip_per_minute=2) as client:
        # Rotating the header must not mint fresh allowances.
        statuses = [
            client.get("/api/v1/users/me", headers={"X-Forwarded-For": f"203.0.113.{i}"}).status_code
            for i in range(4)
        ]
        assert statuses == [401, 401, 429, 429]
    with _client(rate_limit_ip_per_minute=2, trust_proxy_headers=True) as client:
        # Behind a trusted proxy the header identifies the client, so distinct clients are separate.
        assert client.get("/api/v1/users/me", headers=spoof).status_code == 401
        assert client.get("/api/v1/users/me", headers={"X-Forwarded-For": "198.51.100.4"}).status_code == 401


def test_limits_can_be_disabled():
    with _client() as client:
        assert all(client.get("/api/v1/users/me", headers=AUTH).status_code == 200 for _ in range(50))


# ---- The limiter itself -----------------------------------------------------------------------


class FakeClock:
    def __init__(self) -> None:
        self.now = 1_000.0

    def __call__(self) -> float:
        return self.now


def test_the_window_slides_so_allowance_returns_over_time():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(limit=2, window=60, clock=clock)

    assert limiter.check("k") == (True, 0.0)
    clock.now += 10
    assert limiter.check("k") == (True, 0.0)

    allowed, retry_after = limiter.check("k")
    assert allowed is False
    assert retry_after == pytest.approx(50.0)

    clock.now += 51  # the first hit has now left the window
    assert limiter.check("k")[0] is True
    assert limiter.check("k")[0] is False


def test_rejected_attempts_do_not_extend_the_block():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(limit=1, window=60, clock=clock)
    limiter.check("k")

    for _ in range(100):
        clock.now += 0.1
        assert limiter.check("k")[0] is False

    clock.now += 60
    assert limiter.check("k")[0] is True


def test_idle_keys_are_swept_so_memory_stays_bounded():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(limit=5, window=60, clock=clock, max_keys=50)
    for index in range(200):
        limiter.check(f"client-{index}")
        clock.now += 1

    assert len(limiter._hits) <= 110  # swept once past the cap; old windows are dropped
