"""Behavioural contract every Repository implementation must satisfy.

Runs against InMemoryRepository always, and against FirestoreRepository on the
Firestore emulator when FIRESTORE_EMULATOR_HOST is set (see conftest.py).
All data is synthetic.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.core.errors import ApiError
from app.repositories.firestore import path

T0 = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)


def _seed_sessions(repository, count=5):
    for index in range(count):
        repository.set(
            path("subjects", "s1", "sessions", f"sess-{index}"),
            {"created_at": T0 + timedelta(minutes=index), "status": "open" if index % 2 == 0 else "closed"},
        )


def test_get_set_roundtrip_and_missing_document(repository):
    assert repository.get("subjects/missing") is None
    repository.set("subjects/s1", {"label": "synthetic", "nested": {"n": 1}, "created_at": T0})
    document = repository.get("subjects/s1")
    assert document.id == "s1"
    assert document["label"] == "synthetic"
    assert document["nested"] == {"n": 1}
    assert document["created_at"] == T0


def test_set_replaces_and_merge_preserves(repository):
    repository.set("subjects/s1", {"a": 1, "b": 2})
    repository.set("subjects/s1", {"a": 9}, merge=True)
    merged = repository.get("subjects/s1")
    assert (merged["a"], merged["b"]) == (9, 2)
    repository.set("subjects/s1", {"c": 3})
    replaced = repository.get("subjects/s1")
    assert "a" not in replaced and replaced["c"] == 3


def test_update_changes_fields_and_fails_safely_when_missing(repository):
    repository.set("subjects/s1", {"label": "before", "keep": True})
    repository.update("subjects/s1", {"label": "after"})
    document = repository.get("subjects/s1")
    assert document["label"] == "after" and document["keep"] is True

    with pytest.raises(ApiError) as error:
        repository.update("subjects/does-not-exist", {"label": "x"})
    assert error.value.status_code == 503
    assert repository.get("subjects/does-not-exist") is None


def test_delete_is_idempotent(repository):
    repository.set("subjects/s1", {"a": 1})
    repository.delete("subjects/s1")
    repository.delete("subjects/s1")
    assert repository.get("subjects/s1") is None


def test_list_is_scoped_to_one_collection_level(repository):
    repository.set("subjects/s1", {"x": 1})
    repository.set("subjects/s1/sessions/a", {"x": 1})
    repository.set("subjects/s1/sessions/a/events/e1", {"x": 1})
    repository.set("subjects/s2/sessions/b", {"x": 1})

    assert {doc.id for doc in repository.list("subjects/s1/sessions")} == {"a"}
    assert {doc.id for doc in repository.list("subjects")} == {"s1"}
    assert repository.list("subjects/none/sessions") == []


def test_list_filters_order_and_limit(repository):
    _seed_sessions(repository)
    collection = path("subjects", "s1", "sessions")

    open_ids = {d.id for d in repository.list(collection, filters=(("status", "==", "open"),))}
    assert open_ids == {"sess-0", "sess-2", "sess-4"}

    newest_first = repository.list(collection, order_by=("created_at", "desc"), limit=2)
    assert [d.id for d in newest_first] == ["sess-4", "sess-3"]

    oldest_first = repository.list(collection, order_by=("created_at", "asc"))
    assert [d.id for d in oldest_first] == [f"sess-{i}" for i in range(5)]


@pytest.mark.parametrize("descending", [False, True])
def test_page_walks_every_document_exactly_once(repository, descending):
    _seed_sessions(repository, count=7)
    collection = path("subjects", "s1", "sessions")

    seen: list[str] = []
    cursor = None
    for _ in range(10):
        batch = repository.page(
            collection, order_by="created_at", descending=descending, after=cursor, limit=3
        )
        if not batch:
            break
        seen.extend(doc.id for doc in batch)
        last = batch[-1]
        cursor = (last["created_at"], last.id)

    expected = [f"sess-{i}" for i in range(7)]
    assert seen == (list(reversed(expected)) if descending else expected)


def test_page_breaks_timestamp_ties_by_document_id(repository):
    for name in ("b", "a", "c"):
        repository.set(path("subjects", "s1", "sessions", name), {"created_at": T0})
    collection = path("subjects", "s1", "sessions")

    first = repository.page(collection, order_by="created_at", descending=False, after=None, limit=2)
    assert [d.id for d in first] == ["a", "b"]
    rest = repository.page(
        collection, order_by="created_at", descending=False, after=(T0, first[-1].id), limit=2
    )
    assert [d.id for d in rest] == ["c"]


def test_transaction_commits_all_writes_atomically(repository):
    repository.set("subjects/s1", {"count": 1})

    def increment(tx):
        current = tx.get("subjects/s1")
        tx.set("subjects/s1", {"count": current["count"] + 1})
        tx.set("subjects/s1/sessions/new", {"created_at": T0})
        return current["count"]

    assert repository.run_transaction(increment) == 1
    assert repository.get("subjects/s1")["count"] == 2
    assert repository.get("subjects/s1/sessions/new") is not None


def test_transaction_that_raises_writes_nothing(repository):
    repository.set("subjects/s1", {"count": 1})

    def failing(tx):
        tx.set("subjects/s1", {"count": 99})
        tx.set("subjects/s1/sessions/leaked", {"x": 1})
        raise ApiError(409, "synthetic_conflict", "Synthetic conflict.")

    with pytest.raises(ApiError) as error:
        repository.run_transaction(failing)
    assert error.value.code == "synthetic_conflict"
    assert repository.get("subjects/s1")["count"] == 1
    assert repository.get("subjects/s1/sessions/leaked") is None


def test_transaction_reads_collections_with_filters(repository):
    _seed_sessions(repository)

    def count_open(tx):
        return len(tx.list(path("subjects", "s1", "sessions"), filters=(("status", "==", "open"),)))

    assert repository.run_transaction(count_open) == 3


def test_invalid_path_shapes_are_rejected(repository):
    """Document paths need an even number of segments, collections an odd number.

    Regression: the Twin history was once written to
    ``subjects/{id}/digitalTwin/history/{historyId}`` (5 segments), which the
    in-memory double accepted but real Firestore rejects.
    """
    with pytest.raises((ValueError, ApiError)):
        repository.set("subjects/s1/digitalTwin/history/h1", {"x": 1})
    with pytest.raises((ValueError, ApiError)):
        repository.get("subjects")  # a collection, not a document
    with pytest.raises((ValueError, ApiError)):
        repository.list("subjects/s1")  # a document, not a collection

    def writes_bad_path(tx):
        tx.set("subjects/s1/digitalTwin/history/h1", {"x": 1})

    with pytest.raises((ValueError, ApiError)):
        repository.run_transaction(writes_bad_path)


def test_readiness_check(repository):
    assert repository.check() is True
