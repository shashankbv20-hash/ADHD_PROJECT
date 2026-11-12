"""Stroop task: fixed trial list, event validation and event-derived metrics.

A colour word is shown in an ink colour. The child chooses the *ink* colour, not what the word says.
On congruent trials the word and ink agree (RED in red); on incongruent trials they conflict
(RED in blue). The server derives congruence from the word and ink, so a browser cannot relabel a
trial. The interference score is the mean correct reaction time on incongruent trials minus the
mean on congruent trials. This is a research measurement, not a clinical assessment.
"""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import mean
from typing import Any

from app.core.errors import ApiError
from app.schemas import StroopEventInput

STROOP_CODE = "stroop"
STROOP_CALCULATION_VERSION = "backend-stroop-scoring-v1"
STROOP_DATA_PROVENANCE = "frontend-stroop-demo-event-derived-v1"
RESPONSE_WINDOW_MS = 2200
COLORS = ("R", "G", "B", "Y")  # red, green, blue, yellow

# (word colour, ink colour) per trial. Every block of 8 has 4 congruent and 4 incongruent trials.
PRACTICE_WORDS = "RGBYGRYB"
PRACTICE_INKS = "RBBRGYYG"
SCORED_WORDS = "RGBYGRYBGYRBRGYYBRYGBYRGYBGRYGBR"
SCORED_INKS = "RBBGGYYRYYGBRBYGRRYBBGRBYGGRBGYY"


def expected_trials(mode: str) -> tuple[tuple[str, str], ...]:
    if mode == "practice":
        words, inks = PRACTICE_WORDS, PRACTICE_INKS
    elif mode == "scored":
        words, inks = SCORED_WORDS, SCORED_INKS
    else:
        raise ApiError(422, "unsupported_activity_mode", "The requested activity mode is unsupported.")
    return tuple(zip(words, inks, strict=True))


def trial_count(mode: str) -> int:
    return len(expected_trials(mode))


def configuration_snapshot(mode: str) -> dict[str, Any]:
    return {
        "practice_trials": [{"word": w, "ink": i} for w, i in expected_trials("practice")],
        "scored_trials": [{"word": w, "ink": i} for w, i in expected_trials("scored")],
        "colors": list(COLORS),
        "response_window_ms": RESPONSE_WINDOW_MS,
        "trial_index_base": 0,
        "configuration_version": "frontend-stroop-config-v1",
        "stimuli": [f"{w}/{i}" for w, i in expected_trials(mode)],
        "configuration_source": "frontend-stroop-config-v1",
    }


def validate_stroop_event(event: Any, mode: str) -> dict[str, Any]:
    if not isinstance(event, StroopEventInput):
        raise ApiError(422, "invalid_stroop_trial", "The trial is not a Stroop trial.")
    trials = expected_trials(mode)
    if event.trial_index >= len(trials):
        raise ApiError(422, "trial_index_out_of_range", "A trial index is outside the configured sequence.")

    word, ink = trials[event.trial_index]
    if (
        event.trial_id != f"{STROOP_CODE}-{mode}-{event.trial_index + 1:02d}"
        or event.word != word
        or event.ink != ink
    ):
        raise ApiError(422, "invalid_stroop_trial", "The trial does not match the configured sequence.")
    if event.responded and (event.reaction_time_ms is None or event.response_color is None):
        raise ApiError(422, "response_details_required", "A response needs a colour and a reaction time.")
    if not event.responded and (event.reaction_time_ms is not None or event.response_color is not None):
        raise ApiError(422, "response_details_without_response", "No response cannot have a colour or time.")

    congruent = word == ink
    if not event.responded:
        outcome = "omission"
    else:
        outcome = "correct" if event.response_color == ink else "error"

    return {
        "trial_index": event.trial_index,
        "trial_id": event.trial_id,
        "word": word,
        "ink": ink,
        "congruent": congruent,
        "responded": event.responded,
        "response_color": event.response_color,
        "reaction_time_ms": event.reaction_time_ms,
        "outcome": outcome,
        # Event times are server-stamped; browser timestamps are not authoritative.
        "occurred_at": datetime.now(UTC),
    }


def _pct(part: int, whole: int) -> float | None:
    return round(part / whole * 100, 1) if whole else None


def calculate_stroop_metrics(events: list[dict[str, Any]]) -> dict[str, Any]:
    if not events:
        raise ApiError(422, "no_activity_events", "At least one validated event is required.")

    congruent = [e for e in events if e["congruent"]]
    incongruent = [e for e in events if not e["congruent"]]

    def correct(group):
        return [e for e in group if e["outcome"] == "correct"]

    def mean_rt(group):
        rts = [float(e["reaction_time_ms"]) for e in correct(group)]
        return round(mean(rts)) if rts else None

    mean_congruent, mean_incongruent = mean_rt(congruent), mean_rt(incongruent)
    interference = (
        mean_incongruent - mean_congruent
        if mean_congruent is not None and mean_incongruent is not None
        else None
    )

    return {
        "trial_count": len(events),
        "congruent_trial_count": len(congruent),
        "incongruent_trial_count": len(incongruent),
        "correct_count": len(correct(events)),
        "error_count": sum(e["outcome"] == "error" for e in events),
        "omission_count": sum(e["outcome"] == "omission" for e in events),
        "accuracy_percent": _pct(len(correct(events)), len(events)),
        "congruent_accuracy_percent": _pct(len(correct(congruent)), len(congruent)),
        "incongruent_accuracy_percent": _pct(len(correct(incongruent)), len(incongruent)),
        "mean_congruent_reaction_time_ms": mean_congruent,
        "mean_incongruent_reaction_time_ms": mean_incongruent,
        "interference_ms": interference,
        "data_provenance": STROOP_DATA_PROVENANCE,
        "calculation_version": STROOP_CALCULATION_VERSION,
    }
