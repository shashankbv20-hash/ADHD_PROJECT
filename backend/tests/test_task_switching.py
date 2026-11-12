"""Task Switching: server-derived switch/repeat trials, switch cost and isolation from the CPT Twin. Synthetic data."""

from app.schemas import TaskSwitchingEventInput
from app.services.task_switching import (
    calculate_task_switching_metrics,
    correct_side,
    expected_trials,
    trial_type,
    validate_task_switching_event,
)
from tests.test_sessions_and_analytics import _create_subject

CODE = "task-switching"


def _events(mode="scored", *, wrong=(), skip=(), repeat_rt=500, switch_rt=700):
    """Answers correctly except on `wrong` (opposite side) and `skip` (no answer)."""
    events = []
    for index, (rule, colour, shape) in enumerate(expected_trials(mode)):
        if index in skip:
            side, rt = None, None
        else:
            right = correct_side(rule, colour, shape)
            side = ("R" if right == "L" else "L") if index in wrong else right
            rt = switch_rt if trial_type(mode, index) == "switch" else repeat_rt
        events.append(
            {
                "trialIndex": index,
                "trialId": f"{CODE}-{mode}-{index + 1:02d}",
                "rule": rule,
                "colour": colour,
                "shape": shape,
                "responded": side is not None,
                "responseSide": side,
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
    validated = [
        validate_task_switching_event(TaskSwitchingEventInput.model_validate(e), "scored") for e in events
    ]
    return calculate_task_switching_metrics(validated)


def test_trial_lists_have_the_designed_shape():
    for mode, size in (("practice", 8), ("scored", 32)):
        trials = expected_trials(mode)
        assert len(trials) == size
        types = [trial_type(mode, i) for i in range(size)]
        assert types[0] == "first" and "switch" in types and "repeat" in types
    scored = expected_trials("scored")
    types = [trial_type("scored", i) for i in range(32)]
    assert types.count("switch") == 16 and types.count("repeat") == 15
    # Every colour/shape combination appears equally often, and each rule is used.
    combos = [(c, s) for _, c, s in scored]
    assert all(combos.count(pair) == 8 for pair in {("R", "O"), ("R", "Q"), ("B", "O"), ("B", "Q")})
    assert {rule for rule, _, _ in scored} == {"colour", "shape"}
    # Both response sides are correct about equally often.
    sides = [correct_side(*trial) for trial in scored]
    assert 12 <= sides.count("L") <= 20


def test_correct_side_follows_the_rule():
    assert correct_side("colour", "R", "Q") == "L"
    assert correct_side("colour", "B", "O") == "R"
    assert correct_side("shape", "R", "Q") == "R"
    assert correct_side("shape", "B", "O") == "L"


def test_switch_cost_and_condition_accuracy():
    switch_idx = [i for i in range(32) if trial_type("scored", i) == "switch"]
    metrics = _metrics(_events(wrong=(switch_idx[0],), skip=(switch_idx[1],)))

    assert metrics["switch_trial_count"] == 16 and metrics["repeat_trial_count"] == 15
    assert metrics["error_count"] == 1 and metrics["omission_count"] == 1
    assert metrics["repeat_accuracy_percent"] == 100.0
    assert metrics["switch_accuracy_percent"] == 87.5
    assert metrics["accuracy_percent"] == round(30 / 32 * 100, 1)
    assert metrics["mean_repeat_reaction_time_ms"] == 500
    assert metrics["mean_switch_reaction_time_ms"] == 700
    assert metrics["switch_cost_ms"] == 200


def test_switch_cost_is_withheld_without_correct_answers_in_a_condition():
    switch_idx = tuple(i for i in range(32) if trial_type("scored", i) == "switch")
    assert _metrics(_events(skip=switch_idx))["switch_cost_ms"] is None


def test_end_to_end_server_scored_and_kept_out_of_the_twin(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(
        client, participant_headers, subject["id"], "scored", "task-switching-run-01"
    )
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
    assert summaries[0]["metrics"]["switchCostMs"] == 200
    assert summaries[0]["calculationVersion"] == "backend-task-switching-scoring-v1"

    sid = subject["id"]
    twin = client.get(f"/api/v1/subjects/{sid}/digital-twin", headers=participant_headers).json()
    assert twin["version"] == 0 and twin["status"] == "insufficient_data"


def test_a_browser_cannot_relabel_trials(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(
        client, participant_headers, subject["id"], "scored", "task-switching-run-02"
    )
    url = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch"

    swapped = _events()[:1]
    swapped[0]["rule"] = "shape" if swapped[0]["rule"] == "colour" else "colour"  # claim a different rule
    assert client.post(url, headers=participant_headers, json={"events": swapped}).status_code == 422

    no_side = _events()[:1]
    no_side[0]["responseSide"] = None  # responded but no side
    assert client.post(url, headers=participant_headers, json={"events": no_side}).status_code == 422
