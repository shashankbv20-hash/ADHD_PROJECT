import pytest

from app.core.errors import ApiError
from app.repositories.firestore import InMemoryRepository


def test_in_memory_repository_missing_documents_and_defensive_copies():
    repository = InMemoryRepository()
    assert repository.get("subjects/synthetic-subject") is None
    assert repository.list("subjects/synthetic-subject/sessions") == []
    assert repository.check() is True

    original = {"nested": {"value": "synthetic"}}
    repository.set("subjects/synthetic-subject", original)
    original["nested"]["value"] = "mutated"
    fetched = repository.get("subjects/synthetic-subject")
    assert fetched["nested"]["value"] == "synthetic"
    fetched["nested"]["value"] = "also-mutated"
    assert repository.get("subjects/synthetic-subject")["nested"]["value"] == "synthetic"


def test_in_memory_repository_missing_update_is_a_safe_api_error():
    repository = InMemoryRepository()
    with pytest.raises(ApiError) as error:
        repository.update("subjects/missing", {"display_label": "synthetic"})
    assert error.value.status_code == 503
    assert error.value.code == "firestore_write_failed"
    assert repository.get("subjects/missing") is None


def test_firestore_adapter_wraps_storage_exceptions_without_leaking_details():
    from app.repositories.firestore import FirestoreRepository

    class BrokenDocument:
        def get(self):
            raise RuntimeError("synthetic-private-storage-detail")

    class BrokenClient:
        def document(self, _path):
            return BrokenDocument()

    repository = FirestoreRepository(BrokenClient())
    with pytest.raises(ApiError) as error:
        repository.get("subjects/synthetic-subject")
    assert error.value.status_code == 503
    assert error.value.code == "firestore_unavailable"
    assert "synthetic-private-storage-detail" not in error.value.message


def test_firestore_transaction_document_get_consumes_admin_sdk_generator():
    from app.repositories.firestore import FirestoreRepository, _FirestoreTransaction

    class Snapshot:
        id = "synthetic-record"
        exists = True

        @staticmethod
        def to_dict():
            return {"value": "synthetic"}

    class DocumentReference:
        pass

    class Client:
        @staticmethod
        def document(_path):
            return DocumentReference()

    class Transaction:
        @staticmethod
        def get(_reference):
            yield Snapshot()

    repository = FirestoreRepository(Client())
    record = _FirestoreTransaction(repository, Transaction()).get("subjects/synthetic-record")
    assert record is not None
    assert record.id == "synthetic-record"
    assert record["value"] == "synthetic"
