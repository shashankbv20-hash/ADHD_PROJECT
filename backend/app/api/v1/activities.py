from fastapi import APIRouter, Depends

from app.core.errors import ApiError
from app.repositories.dependencies import get_repository
from app.repositories.firestore import Repository, path
from app.schemas import ActivityDefinitionRead
from app.services.catalog import CATALOG

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("", response_model=list[ActivityDefinitionRead])
def list_activities(repository: Repository = Depends(get_repository)) -> list[dict]:
    items = repository.list("activities", order_by=("activity_code", "asc"))
    expected_codes = {item["activity_code"] for item in CATALOG}
    found_codes = {item.id for item in items}
    if not expected_codes.issubset(found_codes):
        raise ApiError(503, "activity_catalog_unavailable", "The activity catalog is unavailable.")
    return [{"activity_code": item.id, **item} for item in items]


@router.get("/{activity_code}", response_model=ActivityDefinitionRead)
def get_activity(activity_code: str, repository: Repository = Depends(get_repository)) -> dict:
    activity = repository.get(path("activities", activity_code))
    if activity is None:
        if activity_code in {item["activity_code"] for item in CATALOG}:
            raise ApiError(503, "activity_catalog_unavailable", "The activity catalog is unavailable.")
        raise ApiError(404, "activity_not_found", "The activity definition was not found.")
    return {"activity_code": activity.id, **activity}
