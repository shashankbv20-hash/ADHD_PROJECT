"""Stroop: server-derived congruence, interference score and isolation from the CPT Twin. Synthetic data."""

from app.schemas import StroopEventInput
from app.services.stroop import (
    PRACTICE_INKS,
    PRACTICE_WORDS,
    SCORED_INKS,
    SCORED_WORDS,
    calculate_stroop_metrics,
    expected_trials,
    validate_stroop_event,
)
from tests.test_sessions_and_analytics import _create_subject

CODE = "stroop"


def _events(mode="scored", *, wrong=(), skip=(), congruent_rt=500, incongruent_rt=650):
    """Answers the ink colour correctly except on `wrong` (a different colour) and `skip` (no answer)."""
    events = []
    for index, (word, ink) in enumerate(expected_trials(mode)):
        if index in skip:
            answer, rt = None, None
        else:
            answer = next(c for c in "RGBY" if c != ink) if index in wrong else ink
            rt = congruent_rt if word == ink else incongruent_rt
        events.append(
            {
                "trialIndex": index,
                "trialId": f"{CODE}-{mode}-{index + 1:02d}",
                "word": word,
                "ink": ink,
                "responded": answer is not None,
                "responseColor": answer,
                "reactionTimeMs": rt,
            }
        )
    return events


def _session(client, headers, subject_id, mode, key):
    response = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={
            "subjectId": subject_id,
            "idempotencyKey": key,
            "activities": [{"activityCode": CODE, "mode": mode}],
        },
    )
    assert response.status_code == 201, response.text
    session = response.json()
    assert client.post(f"/api/v1/sessions/{session['id']}/start", headers=headers).status_code == 200
    assignment_id = session["activities"][0]["id"]
    started = client.post(
        f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/start", headers=headers
    )
    assert started.status_code == 200, started.text
    return session, assignment_id


def _metrics(events):
    validated = [validate_stroop_event(StroopEventInput.model_validate(e), "scored") for e in events]
    return calculate_stroop_metrics(validated)


def test_trial_lists_have_the_designed_shape():
    assert len(PRACTICE_WORDS) == len(PRACTICE_INKS) == 8
    assert len(SCORED_WORDS) == len(SCORED_INKS) == 32
    trials = expected_trials("scored")
    for start in range(0, 32, 8):
        block = trials[start : start + 8]
        assert sum(w == i for w, i in block) == 4  # four congruent, four incongruent per block
    assert sum(w == i for w, i in expected_trials("practice")) == 4
    assert {ink for _, ink in trials} == set("RGBY")


def test_interference_score_and_condition_accuracy():
    incongruent_idx = [i for i, (w, k) in enumerate(expected_trials("scored")) if w != k]
    metrics = _metrics(_events(wrong=(incongruent_idx[0],), skip=(incongruent_idx[1],)))

    assert metrics["congruent_trial_count"] == 16 and metrics["incongruent_trial_count"] == 16
    assert metrics["error_count"] == 1 and metrics["omission_count"] == 1
    assert metrics["congruent_accuracy_percent"] == 100.0
    assert metrics["incongruent_accuracy_percent"] == 87.5
    assert metrics["accuracy_percent"] == round(30 / 32 * 100, 1)
    assert metrics["mean_congruent_reaction_time_ms"] == 500
    assert metrics["mean_incongruent_reaction_time_ms"] == 650
    assert metrics["interference_ms"] == 150


def test_interference_is_withheld_without_correct_answers_in_a_condition():
    all_incongruent = [i for i, (w, k) in enumerate(expected_trials("scored")) if w != k]
    assert _metrics(_events(skip=tuple(all_incongruent)))["interference_ms"] is None


def test_end_to_end_server_scored_and_kept_out_of_the_twin(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "stroop-run-01")
    base = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}"

    assert (
        client.post(
            f"{base}/events:batch", headers=participant_headers, json={"events": _events()}
        ).status_code
        == 200
    )
    assert client.post(f"{base}/complete", headers=participant_headers).status_code == 200

    summaries = client.get(f"/api/v1/sessions/{session['id']}/summary", headers=participant_headers).json()
    assert len(summaries) == 1 and summaries[0]["activityCode"] == CODE
    assert summaries[0]["metrics"]["interferenceMs"] == 150
    assert summaries[0]["calculationVersion"] == "backend-stroop-scoring-v1"

    sid = subject["id"]
    twin = client.get(f"/api/v1/subjects/{sid}/digital-twin", headers=participant_headers).json()
    assert twin["version"] == 0 and twin["status"] == "insufficient_data"
    assert (
        client.get(f"/api/v1/subjects/{sid}/progress", headers=participant_headers).json()["summaryCount"]
        == 0
    )


def test_a_browser_cannot_relabel_trials(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "stroop-run-02")
    url = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch"

    swapped = _events()[:1]
    swapped[0]["ink"] = "B" if swapped[0]["ink"] != "B" else "G"  # claim a different ink colour
    assert client.post(url, headers=participant_headers, json={"events": swapped}).status_code == 422

    no_colour = _events()[:1]
    no_colour[0]["responseColor"] = None  # responded but no colour
    assert client.post(url, headers=participant_headers, json={"events": no_colour}).status_code == 422

    cpt_style = [
        {
            "trialIndex": 0,
            "trialId": "stroop-scored-01",
            "stimulus": "R",
            "isTarget": True,
            "responded": False,
            "reactionTimeMs": None,
        }
    ]
    assert client.post(url, headers=participant_headers, json={"events": cpt_style}).status_code == 422
