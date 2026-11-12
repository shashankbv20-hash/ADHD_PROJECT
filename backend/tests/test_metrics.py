from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.metrics import Metrics
from app.main import create_app
from app.repositories.firestore import InMemoryRepository


def make_app(token: str | None):
    settings = Settings(
        firebase_project_id="demo-metrics",
        metrics_token=token,
        rate_limit_per_minute=0,
        rate_limit_ip_per_minute=0,
    )
    return create_app(settings, repository=InMemoryRepository(), token_verifier=lambda t, p: {"uid": "u"})


def test_metrics_disabled_without_token():
    with TestClient(make_app(None)) as client:
        assert client.get("/metrics").status_code == 404


def test_metrics_requires_the_token_and_exposes_route_templates():
    with TestClient(make_app("s3cret")) as client:
        client.get("/health/live")
        assert client.get("/metrics").status_code == 401
        assert client.get("/metrics", headers={"Authorization": "Bearer wrong"}).status_code == 401
        response = client.get("/metrics", headers={"Authorization": "Bearer s3cret"})
        assert response.status_code == 200
        text = response.text
        assert 'attune_http_requests_total{method="GET",route="/health/live",status="2xx"}' in text
        assert "attune_http_request_duration_ms_bucket" in text
        assert "attune_unhandled_errors_total 0" in text


def test_unhandled_errors_are_counted_and_do_not_leak():
    app = make_app("t")

    @app.get("/boom")
    def boom():
        raise RuntimeError("secret internals")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/boom")
        assert response.status_code == 500
        assert "secret internals" not in response.text
        text = client.get("/metrics", headers={"Authorization": "Bearer t"}).text
        assert "attune_unhandled_errors_total 1" in text
        assert 'status="5xx"' in text


def test_histogram_buckets_are_cumulative():
    metrics = Metrics()
    metrics.observe("GET", "/x", 200, 10)
    metrics.observe("GET", "/x", 200, 300)
    text = metrics.render()
    assert 'le="25"} 1' in text
    assert 'le="500"} 2' in text
    assert 'le="+Inf"} 2' in text
