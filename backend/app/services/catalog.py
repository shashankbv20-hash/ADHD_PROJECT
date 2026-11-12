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
        "description": "Frontend demonstration Go/No-Go with a deterministic 32-trial sequence; not a clinical assessment.",
        "availability": "available",
        "estimated_duration_minutes": 3,
        "activity_version": "frontend-go-no-go-demo-v1",
    },
    {
        "activity_code": "stop-signal",
        "title": "Stop-Signal",
        "description": "Frontend demonstration Stop-Signal task with a deterministic 32-trial sequence; not a clinical assessment.",
        "availability": "available",
        "estimated_duration_minutes": 4,
        "activity_version": "frontend-stop-signal-demo-v1",
    },
    {
        "activity_code": "stroop",
        "title": "Stroop",
        "description": "Frontend demonstration Stroop task with a deterministic 32-trial list; not a clinical assessment.",
        "availability": "available",
        "estimated_duration_minutes": 4,
        "activity_version": "frontend-stroop-demo-v1",
    },
    {
        "activity_code": "task-switching",
        "title": "Task Switching",
        "description": "Frontend demonstration Task Switching (colour or shape rule, 32 trials); not a clinical assessment.",
        "availability": "available",
        "estimated_duration_minutes": 4,
        "activity_version": "frontend-task-switching-demo-v1",
    },
    {
        "activity_code": "visual-search",
        "title": "Visual Search",
        "description": "Frontend demonstration Visual Search (find a red T among distractors, 30 trials); not a clinical assessment.",
        "availability": "available",
        "estimated_duration_minutes": 4,
        "activity_version": "frontend-visual-search-demo-v1",
    },
    {
        "activity_code": "planning-puzzle",
        "title": "Planning Puzzle",
        "description": "Frontend demonstration Planning Puzzle (Tower of Hanoi, 3 scored puzzles); not a clinical assessment.",
        "availability": "available",
        "estimated_duration_minutes": 6,
        "activity_version": "frontend-planning-puzzle-demo-v1",
    },
    {
        "activity_code": "time-perception",
        "title": "Time Perception",
        "description": "Frontend demonstration Time Perception (reproduce durations, 8 trials); not a clinical assessment.",
        "availability": "available",
        "estimated_duration_minutes": 3,
        "activity_version": "frontend-time-perception-demo-v1",
    },
    {
        "activity_code": "multiple-object-tracking",
        "title": "Multiple Object Tracking",
        "description": "Frontend demonstration Multiple Object Tracking (track 2 to 4 of 8 moving circles, 6 trials); not a clinical assessment.",
        "availability": "available",
        "estimated_duration_minutes": 5,
        "activity_version": "frontend-object-tracking-demo-v1",
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
        "description": "Frontend demonstration N-back (1-back then 2-back, 32 trials); not a clinical assessment.",
        "availability": "available",
        "estimated_duration_minutes": 4,
        "activity_version": "frontend-n-back-demo-v1",
    },
    {
        "activity_code": "visual-sequence",
        "title": "Visual Sequence Memory",
        "description": "Frontend demonstration Visual Sequence Memory (3x3 grid, spans 3 to 6, 8 trials); not a clinical assessment.",
        "availability": "available",
        "estimated_duration_minutes": 4,
        "activity_version": "frontend-visual-sequence-demo-v1",
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

# v2: response window 2.2 s (v1 was 1.2 s). A newer current configuration wins, so existing v1 documents are ignored.
CPT_CONFIG_VERSION = "frontend-cpt-config-v2"

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
        config_path = path("activities", "cpt", "configurations", CPT_CONFIG_VERSION)
        existing = [tx.get(p) for p, _ in definitions]
        config = tx.get(config_path)
        for (doc_path, item), found in zip(definitions, existing, strict=True):
            if found is None:
                tx.set(doc_path, {**item, "created_at": now})
        if config is None:
            tx.set(
                config_path,
                {
                    "version": CPT_CONFIG_VERSION,
                    "configuration": CPT_CONFIGURATION,
                    "is_current": True,
                    "created_at": now,
                },
            )

    repository.run_transaction(seed)
