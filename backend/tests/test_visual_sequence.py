"""Visual Sequence Memory: server-held sequences, span metrics and isolation from the Twin. Synthetic data."""

import itertools

from app.schemas import VisualSequenceEventInput
from app.services.visual_sequence import (
    SCORED_SEQUENCES,
    calculate_visual_sequence_metrics,
    expected_sequences,
    validate_visual_sequence_event,
)
from tests.test_sessions_and_analytics import _create_subject

CODE = "visual-sequence"


def _events(mode="scored", *, wrong=(), empty=(), short=()):
    """Taps the sequence correctly, except `wrong` (one tap changed), `empty` (no taps), `short` (cut)."""
    events = []
    for index, sequence in enumerate(expected_sequences(mode)):
        response = list(sequence)
        if index in wrong:
            response[-1] = (response[-1] + 1) % 9
        if index in short:
            response = response[:-2]
        if index in empty:
            response = []
        events.append(
            {
                "trialIndex": index,
                "trialId": f"{CODE}-{mode}-{index + 1:02d}",
                "sequenceLength": len(sequence),
                "response": response,
                "firstResponseLatencyMs": 800 if response else None,
                "totalResponseTimeMs": 800 + 500 * len(response),
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
        validate_visual_sequence_event(VisualSequenceEventInput.model_validate(e), "scored") for e in events
    ]
    return calculate_visual_sequence_metrics(validated)


def test_sequences_have_the_designed_shape():
    assert [len(s) for s in SCORED_SEQUENCES] == [3, 3, 4, 4, 5, 5, 6, 6]
    for raw in (*SCORED_SEQUENCES, "26"):
        assert all(a != b for a, b in itertools.pairwise(raw))  # no immediate repeats
        assert all(c in "012345678" for c in raw)


def test_perfect_run_and_span():
    metrics = _metrics(_events())
    assert metrics["correct_count"] == 8 and metrics["accuracy_percent"] == 100.0
    assert metrics["longest_correct_span"] == 6
    assert metrics["correct_position_percent"] == 100.0
    assert metrics["mean_first_response_ms"] == 800


def test_errors_shorten_the_span_and_partial_credit_counts_positions():
    # Trials 6 and 7 (length 6) are wrong and cut short; trial 4/5 (length 5) stay correct.
    metrics = _metrics(_events(wrong=(6,), short=(7,)))
    assert metrics["correct_count"] == 6
    assert metrics["longest_correct_span"] == 5
    total = sum(len(s) for s in SCORED_SEQUENCES)  # 36
    assert metrics["correct_position_percent"] == round((total - 1 - 2) / total * 100, 1)


def test_no_response_trials_are_counted_and_have_no_latency():
    metrics = _metrics(_events(empty=tuple(range(8))))
    assert metrics["no_response_count"] == 8
    assert metrics["longest_correct_span"] is None
    assert metrics["mean_first_response_ms"] is None


def test_end_to_end_server_scored_and_kept_out_of_the_twin(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "sequence-run-01")
    base = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}"

    posted = client.post(f"{base}/events:batch", headers=participant_headers, json={"events": _events()})
    assert posted.status_code == 200, posted.text
    assert client.post(f"{base}/complete", headers=participant_headers).status_code == 200

    summaries = client.get(f"/api/v1/sessions/{session['id']}/summary", headers=participant_headers).json()
    assert len(summaries) == 1 and summaries[0]["activityCode"] == CODE
    assert summaries[0]["metrics"]["longestCorrectSpan"] == 6
    assert summaries[0]["calculationVersion"] == "backend-visual-sequence-scoring-v1"

    twin = client.get(f"/api/v1/subjects/{subject['id']}/digital-twin", headers=participant_headers).json()
    assert twin["version"] == 0 and twin["status"] == "insufficient_data"


def test_a_browser_cannot_claim_the_wrong_sequence_length_or_timing(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "sequence-run-02")
    url = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch"

    wrong_length = _events()[:1]
    wrong_length[0]["sequenceLength"] = 5
    assert client.post(url, headers=participant_headers, json={"events": wrong_length}).status_code == 422

    too_long = _events()[:1]
    too_long[0]["response"] = [1, 2, 3, 4]
    assert client.post(url, headers=participant_headers, json={"events": too_long}).status_code == 422

    no_time = _events()[:1]
    no_time[0]["firstResponseLatencyMs"] = None
    assert client.post(url, headers=participant_headers, json={"events": no_time}).status_code == 422
