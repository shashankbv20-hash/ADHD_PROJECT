from fastapi import Request

from app.core.errors import ApiError
from app.repositories.firestore import Repository


def get_repository(request: Request) -> Repository:
    repository = request.app.state.repository
    if repository is None:
        raise ApiError(503, "firestore_not_configured", "The application data store is not configured.")
    return repository
