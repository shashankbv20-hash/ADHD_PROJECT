"""Stop-Signal: server-validated trials, SSRT scoring and isolation from the CPT Twin. Synthetic data."""

from app.schemas import StopSignalEventInput
from app.services.stop_signal import (
    PRACTICE_TYPES,
    SCORED_DIRECTIONS,
    SCORED_TYPES,
    calculate_stop_signal_metrics,
    expected_trials,
    validate_stop_signal_event,
)
from tests.test_sessions_and_analytics import _create_subject

CODE = "stop-signal"


def _events(mode="scored", *, fail_stops=(), skip_go=(), wrong_direction=(), ssd=250, rt=500):
    """fail_stops: indices of stop trials answered anyway."""
    events = []
    for index, (direction, is_stop) in enumerate(expected_trials(mode)):
        responded = (not is_stop and index not in skip_go) or (is_stop and index in fail_stops)
        answer = ("R" if direction == "L" else "L") if index in wrong_direction else direction
        events.append(
            {
                "trialIndex": index,
                "trialId": f"{CODE}-{mode}-{index + 1:02d}",
                "stimulus": direction,
                "isStop": is_stop,
                "stopSignalDelayMs": ssd if is_stop else None,
                "responded": responded,
                "responseDirection": answer if responded else None,
                "reactionTimeMs": rt if responded else None,
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
    validated = [validate_stop_signal_event(StopSignalEventInput.model_validate(e), "scored") for e in events]
    return calculate_stop_signal_metrics(validated)


def test_sequence_shape():
    assert len(SCORED_DIRECTIONS) == len(SCORED_TYPES) == 32 and SCORED_TYPES.count("s") == 8
    for start in range(0, 32, 8):
        assert "".join(SCORED_TYPES[start : start + 8]).count("s") == 2
    assert "ss" not in "".join(SCORED_TYPES)
    assert PRACTICE_TYPES.count("s") == 2 and set(SCORED_DIRECTIONS) == {"L", "R"}


def test_metrics_with_a_usable_ssrt():
    stops = [i for i, (_, is_stop) in enumerate(expected_trials("scored")) if is_stop]
    metrics = _metrics(_events(fail_stops=stops[:3], skip_go=(0,), wrong_direction=(1,)))

    assert metrics["go_trial_count"] == 24 and metrics["stop_trial_count"] == 8
    assert metrics["go_omission_count"] == 1 and metrics["go_wrong_direction_count"] == 1
    assert metrics["go_correct_count"] == 22
    assert metrics["failed_stop_count"] == 3 and metrics["successful_stop_count"] == 5
    assert metrics["stop_success_rate_percent"] == 62.5
    assert metrics["mean_stop_signal_delay_ms"] == 250
    assert metrics["mean_go_reaction_time_ms"] == 500
    assert metrics["ssrt_reliable"] is True and metrics["ssrt_estimate_ms"] == 250  # 500 - 250


def test_ssrt_is_withheld_when_stopping_is_always_or_never_successful():
    assert _metrics(_events())["ssrt_estimate_ms"] is None  # every stop succeeded
    every_stop = [i for i, (_, is_stop) in enumerate(expected_trials("scored")) if is_stop]
    assert _metrics(_events(fail_stops=every_stop))["ssrt_reliable"] is False  # every stop failed


def test_event_validation_rules():
    base = _events()
    stop_index = next(i for i, e in enumerate(base) if e["isStop"])

    def check(mutator, ok=False):
        events = [dict(e) for e in base]
        mutator(events)
        try:
            validate_stop_signal_event(StopSignalEventInput.model_validate(events[stop_index]), "scored")
            return True
        except Exception:
            return False

    assert check(lambda ev: None)
    assert not check(lambda ev: ev[stop_index].update(stopSignalDelayMs=None))
    assert not check(lambda ev: ev[stop_index].update(stopSignalDelayMs=275))  # not a 50 ms step
    assert not check(lambda ev: ev[stop_index].update(stopSignalDelayMs=1050))
    assert not check(lambda ev: ev[stop_index].update(responded=True))  # needs direction and time
    assert not check(lambda ev: ev[stop_index].update(isStop=False))
    assert not check(lambda ev: ev[stop_index].update(trialId="stop-signal-scored-99"))


def test_end_to_end_session_is_scored_and_kept_out_of_the_cpt_twin(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "ss-run-01")
    base = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}"
    stops = [i for i, (_, is_stop) in enumerate(expected_trials("scored")) if is_stop]

    ingested = client.post(
        f"{base}/events:batch", headers=participant_headers, json={"events": _events(fail_stops=stops[:3])}
    )
    assert ingested.status_code == 200, ingested.text
    assert client.post(f"{base}/complete", headers=participant_headers).status_code == 200

    summaries = client.get(f"/api/v1/sessions/{session['id']}/summary", headers=participant_headers).json()
    assert len(summaries) == 1 and summaries[0]["activityCode"] == CODE
    assert summaries[0]["metrics"]["ssrtEstimateMs"] == 250
    assert summaries[0]["metrics"]["failedStopCount"] == 3

    sid = subject["id"]
    twin = client.get(f"/api/v1/subjects/{sid}/digital-twin", headers=participant_headers).json()
    assert twin["version"] == 0 and twin["status"] == "insufficient_data"
    listed = client.get(f"/api/v1/subjects/{sid}/activity-summaries", headers=participant_headers)
    assert listed.status_code == 200 and listed.json()["items"][0]["activityCode"] == CODE


def test_cpt_style_events_are_refused_for_stop_signal_and_vice_versa(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "ss-run-02")
    url = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch"
    cpt_event = {
        "trialIndex": 0,
        "trialId": "stop-signal-scored-01",
        "stimulus": "L",
        "isTarget": True,
        "responded": False,
        "reactionTimeMs": None,
    }
    assert client.post(url, headers=participant_headers, json={"events": [cpt_event]}).status_code == 422
