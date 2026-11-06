from fastapi import APIRouter, Depends

from app.auth.dependencies import CurrentUser
from app.core.errors import ApiError
from app.repositories.dependencies import get_repository
from app.repositories.firestore import Repository
from app.schemas import AiBuddyMessageRequest
from app.services.authorization import get_subject_for_user
from app.services.sessions import get_session

router = APIRouter(prefix="/ai-buddy", tags=["ai-buddy"])


@router.post(
    "/messages",
    status_code=503,
    responses={503: {"description": "No approved LLM provider is configured."}},
)
def send_ai_buddy_message(
    payload: AiBuddyMessageRequest,
    current_user: CurrentUser,
    repository: Repository = Depends(get_repository),
) -> None:
    if payload.session_id is not None:
        session = get_session(repository, current_user, payload.session_id)
        subject_id = str(session.subject_id)
        if payload.subject_id is not None and str(payload.subject_id) != subject_id:
            raise ApiError(404, "session_not_found", "The requested session was not found.")
    elif payload.subject_id is not None:
        get_subject_for_user(repository, current_user, payload.subject_id)

    # No approved provider is configured. The user's message is not sent,
    # logged, stored, or replaced with a fabricated response.
    raise ApiError(
        503,
        "ai_buddy_unavailable",
        "The AI Buddy provider is not configured; no message was sent.",
    )
