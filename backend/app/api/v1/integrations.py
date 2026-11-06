from fastapi import APIRouter, Request

router = APIRouter(tags=["capabilities"])


@router.get("/capabilities")
def capabilities(request: Request) -> dict:
    settings = request.app.state.settings
    repository = request.app.state.repository
    return {
        "apiVersion": "v1",
        "databaseConfigured": repository is not None,
        "firestore": {"configured": repository is not None},
        "firebaseAuth": {
            "projectIdConfigured": bool(settings.firebase_project_id),
            "credentials": "application_default_credentials_required_at_runtime",
        },
        "eeg": {
            "available": False,
            "reason": "model_artifact_and_training_preprocessing_not_found",
        },
        "webcam": {
            "available": False,
            "reason": "consent_policy_and_supported_feature_extractor_not_configured",
        },
        "aiBuddy": {
            "available": False,
            "reason": "approved_llm_provider_not_configured",
        },
    }
