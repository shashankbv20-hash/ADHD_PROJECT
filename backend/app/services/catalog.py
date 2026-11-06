from datetime import UTC, datetime

from app.repositories.firestore import Repository, path
from app.services.cpt_scoring import CPT_PRACTICE_STIMULI, CPT_RESPONSE_WINDOW_MS, CPT_SCORED_STIMULI

CATALOG = (
    {
        "activity_code": "cpt",
        "title": "Continuous Performance Task",
        "description": "Frontend demonstration CPT with a deterministic 24-trial sequence; not a clinical assessment.",
        "availability": "available",
        "estimated_duration_minutes": 3,
        "activity_version": "frontend-cpt-demo-v1",
    },
    {
        "activity_code": "go-no-go",
        "title": "Go / No-Go",
        "description": "Planned activity; no backend trial definition is implemented.",
        "availability": "planned",
        "estimated_duration_minutes": 4,
        "activity_version": "planned-v1",
    },
    {
        "activity_code": "selective-attention",
        "title": "Selective Attention",
        "description": "Planned activity; no backend trial definition is implemented.",
        "availability": "planned",
        "estimated_duration_minutes": 5,
        "activity_version": "planned-v1",
    },
    {
        "activity_code": "n-back",
        "title": "N-back",
        "description": "Planned activity; no backend trial definition is implemented.",
        "availability": "planned",
        "estimated_duration_minutes": 5,
        "activity_version": "planned-v1",
    },
    {
        "activity_code": "visual-sequence",
        "title": "Visual Sequence Memory",
        "description": "Planned activity; no backend trial definition is implemented.",
        "availability": "planned",
        "estimated_duration_minutes": 4,
        "activity_version": "planned-v1",
    },
    {
        "activity_code": "focus-arena",
        "title": "Focus Arena",
        "description": "Planned activity; no backend trial definition is implemented.",
        "availability": "planned",
        "estimated_duration_minutes": 6,
        "activity_version": "planned-v1",
    },
)

CPT_CONFIGURATION = {
    "practice_stimuli": list(CPT_PRACTICE_STIMULI),
    "scored_stimuli": list(CPT_SCORED_STIMULI),
    "target_stimulus": "X",
    "response_window_ms": CPT_RESPONSE_WINDOW_MS,
    "stimulus_duration_ms": 650,
    "trial_index_base": 0,
}


def seed_catalog(repository: Repository) -> None:
    """Create missing, versioned catalog documents without overwriting operator data."""
    now = datetime.now(UTC)

    def seed(tx):
        definitions = [(path("activities", item["activity_code"]), item) for item in CATALOG]
        config_path = path("activities", "cpt", "configurations", "frontend-cpt-config-v1")
        existing = [tx.get(p) for p, _ in definitions]
        config = tx.get(config_path)
        for (doc_path, item), found in zip(definitions, existing, strict=True):
            if found is None:
                tx.set(doc_path, {**item, "created_at": now})
        if config is None:
            tx.set(
                config_path,
                {
                    "version": "frontend-cpt-config-v1",
                    "configuration": CPT_CONFIGURATION,
                    "is_current": True,
                    "created_at": now,
                },
            )

    repository.run_transaction(seed)
