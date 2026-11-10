from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.health import router as health_router
from app.api.v1.router import api_router
from app.auth.dependencies import TokenVerifier
from app.auth.firebase import verify_firebase_id_token
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.core.hardening import HardeningMiddleware
from app.core.logging_config import configure_logging
from app.repositories.firestore import FirestoreRepository, Repository
from app.services.catalog import seed_catalog

logger = logging.getLogger("attune.http")


def create_app(
    settings: Settings | None = None,
    *,
    token_verifier: TokenVerifier | None = None,
    repository: Repository | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    store = repository or FirestoreRepository.from_default_credentials(
        settings.firebase_project_id, settings.firestore_database_id
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if store is not None:
            try:
                seed_catalog(store)
                app.state.catalog_initialized = True
            except Exception as exc:
                app.state.catalog_initialized = False
                logger.warning("firestore_catalog_initialization_failed error_type=%s", type(exc).__name__)
        yield

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Research/support API. Predictions are not diagnoses.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.repository = store
    app.state.catalog_initialized = False
    app.state.token_verifier = token_verifier or verify_firebase_id_token

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def safe_request_logging(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid4())
        request.state.request_id = request_id
        started = perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            logger.error(
                "request_failed request_id=%s method=%s route=%s error_type=%s",
                request_id,
                request.method,
                getattr(request.scope.get("route"), "path", "unmatched"),
                type(exc).__name__,
            )
            raise
        route = getattr(request.scope.get("route"), "path", "unmatched")
        duration_ms = round((perf_counter() - started) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request_completed request_id=%s method=%s route=%s status=%s duration_ms=%s",
            request_id,
            request.method,
            route,
            response.status_code,
            duration_ms,
        )
        return response

    # Added after the logging/CORS middleware so it is outermost: oversized and rate-limited
    # requests are refused before any other work, and every response gets security headers.
    app.add_middleware(
        HardeningMiddleware,
        max_request_bytes=settings.max_request_bytes,
        rate_limit_per_minute=settings.rate_limit_per_minute,
        rate_limit_ip_per_minute=settings.rate_limit_ip_per_minute,
        trust_proxy_headers=settings.trust_proxy_headers,
        hsts=settings.environment.lower() == "production",
    )

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "requestId": getattr(request.state, "request_id", None),
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {
                "loc": list(item.get("loc", ())),
                "msg": item.get("msg", "Invalid value"),
                "type": item.get("type", "value_error"),
            }
            for item in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "request_validation_failed",
                    "message": "The request did not match the required schema.",
                    "requestId": getattr(request.state, "request_id", None),
                    "details": errors,
                }
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        message = str(exc.detail) if isinstance(exc.detail, str) else "The request could not be completed."
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": "http_error",
                    "message": message,
                    "requestId": getattr(request.state, "request_id", None),
                }
            },
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        logger.error("unhandled_error request_id=%s error_type=%s", request_id, type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "The request could not be completed.",
                    "requestId": request_id,
                }
            },
        )

    app.include_router(health_router)
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
