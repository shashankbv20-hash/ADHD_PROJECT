import logging

from fastapi import APIRouter, Depends, Request

from app.core.errors import ApiError
from app.repositories.dependencies import get_repository
from app.repositories.firestore import Repository

logger = logging.getLogger(__name__)
router = APIRouter(tags=["health"])


@router.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
def ready(request: Request, repository: Repository = Depends(get_repository)) -> dict[str, str]:
    if not request.app.state.catalog_initialized:
        raise ApiError(503, "firestore_catalog_unavailable", "The application catalog is unavailable.")
    try:
        if not repository.check():
            raise RuntimeError("Firestore readiness check failed")
    except ApiError:
        raise
    except Exception as exc:
        logger.warning("firestore_readiness_failed error_type=%s", type(exc).__name__)
        raise ApiError(503, "firestore_unavailable", "The application data store is unavailable.") from exc
    return {"status": "ready"}
