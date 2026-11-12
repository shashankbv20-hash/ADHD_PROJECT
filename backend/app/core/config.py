from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Backend-only settings; values are loaded from backend/.env or process env."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Attune API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    firebase_project_id: str | None = None
    firestore_database_id: str = "(default)"
    cors_origins: str = "http://localhost:3000"
    log_level: str = "INFO"
    # Hardening (see app/core/hardening.py). A limit of 0 disables that limiter.
    max_request_bytes: int = 262_144
    rate_limit_per_minute: int = 240  # per authenticated caller
    rate_limit_ip_per_minute: int = 600  # per client address
    # Trust X-Forwarded-For for the client address. Enable ONLY behind a proxy that overwrites it.
    trust_proxy_headers: bool = False
    # Enables GET /metrics (Prometheus text) for callers sending this bearer token. Unset = disabled.
    metrics_token: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
