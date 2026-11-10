from fastapi import APIRouter

from app.api.v1.activities import router as activities_router
from app.api.v1.ai_buddy import router as ai_buddy_router
from app.api.v1.data_rights import router as data_rights_router
from app.api.v1.insights import router as insights_router
from app.api.v1.integrations import router as integrations_router
from app.api.v1.sessions import router as sessions_router
from app.api.v1.subjects import router as subjects_router
from app.api.v1.users import router as users_router

api_router = APIRouter()
api_router.include_router(integrations_router)
api_router.include_router(ai_buddy_router)
api_router.include_router(users_router)
api_router.include_router(subjects_router)
api_router.include_router(activities_router)
api_router.include_router(sessions_router)
api_router.include_router(insights_router)
api_router.include_router(data_rights_router)
