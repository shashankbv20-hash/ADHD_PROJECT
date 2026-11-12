"""Planning Puzzle (Tower of Hanoi): server move replay, metrics and isolation from the Twin. Synthetic data."""

import pytest

from app.core.errors import ApiError
from app.schemas import PlanningPuzzleEventInput
from app.services.planning_puzzle import (
    calculate_planning_puzzle_metrics,
    expected_puzzles,
    minimum_moves,
    replay,
    validate_planning_puzzle_event,
)
from tests.test_sessions_and_analytics import _create_subject

CODE = "planning-puzzle"


def optimal(discs, source="A", target="C", spare="B"):
    """The shortest solution, as moves like 'AC'."""
    if discs == 0:
        return []
    return [
        *optimal(discs - 1, source, spare, target),
        source + target,
        *optimal(discs - 1, spare, target, source),
    ]


def _events(mode="scored", *, extra_moves=(), unsolved=(), skip_all=()):
    events = []
    for index, discs in enumerate(expected_puzzles(mode)):
        moves = [] if index in skip_all else optimal(discs)
        if index in extra_moves:
            moves = ["AB", "BA", *moves]  # a detour: two extra moves
        if index in unsolved:
            moves = moves[:-1]
        events.append(
            {
                "trialIndex": index,
                "trialId": f"{CODE}-{mode}-{index + 1:02d}",
                "discCount": discs,
                "moves": moves,
                "illegalAttempts": 1 if index == 0 else 0,
                "firstMoveLatencyMs": 2000 if moves else None,
                "totalTimeMs": 20000 + 1000 * len(moves),
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
        validate_planning_puzzle_event(PlanningPuzzleEventInput.model_validate(e), "scored") for e in events
    ]
    return calculate_planning_puzzle_metrics(validated)


def test_replay_accepts_the_optimal_solution_and_rejects_illegal_moves():
    assert minimum_moves(3) == 7 and len(optimal(3)) == 7
    assert replay(3, optimal(3)) is True
    assert replay(3, optimal(3)[:-1]) is False
    with pytest.raises(ApiError):
        replay(3, ["AC", "AC"])  # second disc onto the smaller one
    with pytest.raises(ApiError):
        replay(3, ["BC"])  # empty source peg
    with pytest.raises(ApiError):
        replay(3, [*optimal(3), "CA"])  # moves after the solution


def test_metrics_for_optimal_detour_and_unsolved_puzzles():
    metrics = _metrics(_events(extra_moves=(1,), unsolved=(2,)))

    assert metrics["puzzle_count"] == 3 and metrics["solved_count"] == 2
    assert metrics["solved_percent"] == 66.7
    assert metrics["optimal_count"] == 1  # the 3-disc puzzle without a detour
    assert metrics["mean_extra_moves"] == 1.0  # (0 + 2) / 2
    assert metrics["illegal_attempts"] == 1
    assert metrics["mean_planning_time_ms"] == 2000
    assert metrics["total_moves"] == 7 + 9 + 14


def test_skipped_puzzles_are_unsolved_with_no_planning_time():
    metrics = _metrics(_events(skip_all=(0, 1, 2)))
    assert metrics["solved_count"] == 0
    assert metrics["mean_extra_moves"] is None and metrics["mean_solution_time_ms"] is None
    assert metrics["mean_planning_time_ms"] is None


def test_end_to_end_server_scored_and_kept_out_of_the_twin(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "planning-run-01")
    base = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}"

    posted = client.post(f"{base}/events:batch", headers=participant_headers, json={"events": _events()})
    assert posted.status_code == 200, posted.text
    assert client.post(f"{base}/complete", headers=participant_headers).status_code == 200

    summaries = client.get(f"/api/v1/sessions/{session['id']}/summary", headers=participant_headers).json()
    assert len(summaries) == 1 and summaries[0]["activityCode"] == CODE
    assert summaries[0]["metrics"]["solvedCount"] == 3
    assert summaries[0]["calculationVersion"] == "backend-planning-puzzle-scoring-v1"

    twin = client.get(f"/api/v1/subjects/{subject['id']}/digital-twin", headers=participant_headers).json()
    assert twin["version"] == 0 and twin["status"] == "insufficient_data"


def test_a_browser_cannot_claim_an_impossible_solution(test_app, participant_headers):
    _, client = test_app
    client.get("/api/v1/users/me", headers=participant_headers)
    subject = _create_subject(client, participant_headers)
    session, assignment_id = _session(client, participant_headers, subject["id"], "scored", "planning-run-02")
    url = f"/api/v1/sessions/{session['id']}/activities/{assignment_id}/events:batch"

    illegal = _events()[:1]
    illegal[0]["moves"] = ["AC", "AC"]
    assert client.post(url, headers=participant_headers, json={"events": illegal}).status_code == 422

    wrong_size = _events()[:1]
    wrong_size[0]["discCount"] = 4
    assert client.post(url, headers=participant_headers, json={"events": wrong_size}).status_code == 422

    no_time = _events()[:1]
    no_time[0]["firstMoveLatencyMs"] = None
    assert client.post(url, headers=participant_headers, json={"events": no_time}).status_code == 422
