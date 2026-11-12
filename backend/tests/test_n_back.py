"""N-back: server-derived targets, per-level scoring and isolation from the CPT Twin. Synthetic data."""

from app.schemas import CptEventInput
from app.services.cpt_scoring import (
    N_BACK_PRACTICE_STIMULI,
    N_BACK_SCORED_STIMULI,
    calculate_activity_metrics,
    expected_stimuli,
    n_back_level,
    validate_cpt_event,
)
from tests.test_sessions_and_analytics import _create_subject

CODE = "n-back"


def targets(mode):
    """Independent re-derivation of the answer key (match N back within the level)."""
    stimuli = expected_stimuli(mode, CODE)
    result = []
    for index, letter in enumerate(stimuli):
        n = n_back_level(mode, index)
        start = 0 if n == 1 else 16
        result.append(index - start >= n and letter == stimuli[index - n])
    return result


def _events(mode, *, press_on=None, rt=600):
    """Press exactly on target trials by default; press_on overrides the set of pressed indices."""
    key = targets(mode)
    pressed = {i for i, t in enumerate(key) if t} if press_on is None else set(press_on)
    stimuli = expected_stimuli(mode, CODE)
    return [
        {
            "trialIndex": i,
            "trialId": f"{CODE}-{mode}-{i + 1:02d}",
            "stimulus": stimuli[i],
            "isTarget": key[i],
            "responded": i in pressed,
            "reactionTimeMs": rt if i in pressed else None,
        }
        for i in range(len(stimuli))
    ]


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


def test_sequence_design():
    assert len(N_BACK_PRACTICE_STIMULI) == 8 and len(N_BACK_SCORED_STIMULI) == 32
    key = targets("scored")
    assert sum(key[:16]) == 4 and sum(key[16:]) == 4  # four matches per level
    assert sum(targets("practice")) == 2
    # No trial can be a target before it has N predecessors in its own level.
    assert not any(key[:1]) and not any(key[16:18])
    # The two levels are genuinely different: no accidental 1-back repeats inside the 2-back level.
    level2 = N_BACK_SCORED_STIMULI[16:]
    assert all(level2[i] != level2[i - 1] for i in range(1, 16))


def test_scoring_hits_misses_and_false_alarms():
    key = targets("scored")
    first_target = key.index(True)
    non_target = key.index(False, 3)
    pressed = {i for i, t in enumerate(key) if t} - {first_target} | {non_target}
    events = [
        validate_cpt_event(CptEventInput.model_validate(e), "scored", CODE)
        for e in _events("scored", press_on=pressed)
    ]
    metrics = calculate_activity_metrics(events, CODE)

    assert metrics["target_count"] == 8 and metrics["non_target_count"] == 24
    assert metrics["hit_count"] == 7 and metrics["miss_count"] == 1
    assert metrics["false_alarm_count"] == 1 and metrics["omission_error_count"] == 1
    assert metrics["calculation_version"] == "backend-n-back-scoring-v1"
    assert len(metrics["block_metrics"]) == 4  # blocks 1-2 are 1-back, blocks 3-4 are 2-back


def test_end_to_end_server_scored_and_kept_out_of_the_twin(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "nb-run-01")
    base = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}"

    assert (
        client.post(
            f"{base}/events:batch", headers=participant_headers, json={"events": _events("scored")}
        ).status_code
        == 200
    )
    assert client.post(f"{base}/complete", headers=participant_headers).status_code == 200

    summaries = client.get(f"/api/v1/sessions/{session['id']}/summary", headers=participant_headers).json()
    assert len(summaries) == 1 and summaries[0]["activityCode"] == CODE
    assert summaries[0]["metrics"]["hitCount"] == 8 and summaries[0]["metrics"]["accuracyPercent"] == 100
    assert summaries[0]["calculationVersion"] == "backend-n-back-scoring-v1"

    sid = subject["id"]
    twin = client.get(f"/api/v1/subjects/{sid}/digital-twin", headers=participant_headers).json()
    assert twin["version"] == 0 and twin["status"] == "insufficient_data"
    assert (
        client.get(f"/api/v1/subjects/{sid}/progress", headers=participant_headers).json()["summaryCount"]
        == 0
    )


def test_a_browser_cannot_change_the_answer_key(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "nb-run-02")
    url = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch"

    key = targets("scored")
    target_index = key.index(True)
    lie = _events("scored")[target_index : target_index + 1]
    lie[0]["isTarget"] = False  # claiming a real match is not a match
    assert client.post(url, headers=participant_headers, json={"events": lie}).status_code == 422

    wrong_letter = _events("scored")[:1]
    wrong_letter[0]["stimulus"] = "Z"
    assert client.post(url, headers=participant_headers, json={"events": wrong_letter}).status_code == 422
