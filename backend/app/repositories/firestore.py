from __future__ import annotations

import copy
import logging
from collections.abc import Callable, Iterable
from datetime import UTC, datetime
from threading import RLock
from typing import Any, Protocol

from app.core.errors import ApiError

logger = logging.getLogger(__name__)


class Document(dict[str, Any]):
    """Dictionary-backed Firestore document with attribute access for Pydantic."""

    def __init__(self, document_id: str, **data: Any) -> None:
        super().__init__(data)
        self["id"] = document_id
        self.id = document_id

    def __getattr__(self, key: str) -> Any:
        try:
            return self[key]
        except KeyError as exc:
            raise AttributeError(key) from exc

    def __setattr__(self, key: str, value: Any) -> None:
        if key == "id":
            object.__setattr__(self, key, value)
        else:
            self[key] = value


class Transaction(Protocol):
    def get(self, path: str) -> Document | None: ...
    def list(self, path: str, *, filters: tuple[tuple[str, str, Any], ...] = ()) -> list[Document]: ...
    def set(self, path: str, data: dict[str, Any], *, merge: bool = False) -> None: ...
    def update(self, path: str, data: dict[str, Any]) -> None: ...
    def delete(self, path: str) -> None: ...


class Repository(Protocol):
    configured: bool

    def get(self, path: str) -> Document | None: ...
    def list(
        self,
        path: str,
        *,
        filters: tuple[tuple[str, str, Any], ...] = (),
        order_by: tuple[str, str] | None = None,
        limit: int | None = None,
    ) -> list[Document]: ...
    def page(
        self,
        path: str,
        *,
        order_by: str,
        descending: bool,
        after: tuple[Any, str] | None,
        limit: int,
    ) -> list[Document]: ...
    def set(self, path: str, data: dict[str, Any], *, merge: bool = False) -> None: ...
    def update(self, path: str, data: dict[str, Any]) -> None: ...
    def delete(self, path: str) -> None: ...
    def delete_collection(self, path: str) -> int: ...
    def run_transaction(self, callback: Callable[[Transaction], Any]) -> Any: ...
    def check(self) -> bool: ...


def now_utc() -> datetime:
    return datetime.now(UTC)


def _segments(path: str) -> tuple[str, ...]:
    parts = tuple(part for part in path.strip("/").split("/") if part)
    if not parts:
        raise ValueError("A Firestore document/collection path is required.")
    return parts


def _document_segments(path: str) -> tuple[str, ...]:
    """Segments of a document path; like Firestore, document paths have an even number of segments."""
    parts = _segments(path)
    if len(parts) % 2:
        raise ValueError("A document must have an even number of path elements")
    return parts


def _collection_segments(path: str) -> tuple[str, ...]:
    """Segments of a collection path; like Firestore, collection paths have an odd number of segments."""
    parts = _segments(path)
    if len(parts) % 2 == 0:
        raise ValueError("A collection must have an odd number of path elements")
    return parts


class _FirestoreTransaction:
    def __init__(self, repository: FirestoreRepository, transaction: Any):
        self.repository = repository
        self.transaction = transaction

    def get(self, path: str) -> Document | None:
        result = self.transaction.get(self.repository.client.document(path))
        snapshot = result if hasattr(result, "exists") else next(iter(result), None)
        if snapshot is None:
            return None
        if not snapshot.exists:
            return None
        return Document(document_id=snapshot.id, **snapshot.to_dict())

    def list(self, path: str, *, filters: tuple[tuple[str, str, Any], ...] = ()) -> list[Document]:
        query = self.repository.client.collection(path)
        for field, operation, value in filters:
            query = query.where(field, operation, value)
        return [
            Document(document_id=snapshot.id, **snapshot.to_dict())
            for snapshot in query.stream(transaction=self.transaction)
        ]

    def set(self, path: str, data: dict[str, Any], *, merge: bool = False) -> None:
        self.transaction.set(self.repository.client.document(path), data, merge=merge)

    def update(self, path: str, data: dict[str, Any]) -> None:
        self.transaction.update(self.repository.client.document(path), data)

    def delete(self, path: str) -> None:
        self.transaction.delete(self.repository.client.document(path))


class FirestoreRepository:
    """Firebase Admin Firestore adapter. All paths are explicit and scoped by domain owner."""

    configured = True

    def __init__(self, client: Any):
        self.client = client

    @classmethod
    def from_default_credentials(
        cls, project_id: str | None, database_id: str = "(default)"
    ) -> FirestoreRepository | None:
        if not project_id:
            return None
        try:
            import firebase_admin
            from firebase_admin import firestore

            try:
                app = firebase_admin.get_app("attune-backend")
                if app.project_id and app.project_id != project_id:
                    raise ValueError("Firebase Admin app targets a different project.")
            except ValueError:
                app = firebase_admin.initialize_app(options={"projectId": project_id}, name="attune-backend")
            return cls(firestore.client(app=app, database_id=database_id))
        except Exception as exc:
            logger.warning("firestore_initialization_failed error_type=%s", type(exc).__name__)
            return None

    def get(self, path: str) -> Document | None:
        try:
            snapshot = self.client.document(path).get()
            return Document(document_id=snapshot.id, **snapshot.to_dict()) if snapshot.exists else None
        except Exception as exc:
            raise _storage_error(exc) from exc

    def list(
        self,
        path: str,
        *,
        filters: tuple[tuple[str, str, Any], ...] = (),
        order_by: tuple[str, str] | None = None,
        limit: int | None = None,
    ) -> list[Document]:
        try:
            query = self.client.collection(path)
            for field, operation, value in filters:
                query = query.where(field, operation, value)
            if order_by:
                from google.cloud.firestore_v1 import Query

                direction = Query.ASCENDING if order_by[1].lower() == "asc" else Query.DESCENDING
                query = query.order_by(order_by[0], direction=direction)
            if limit is not None:
                query = query.limit(limit)
            return [Document(document_id=snapshot.id, **snapshot.to_dict()) for snapshot in query.stream()]
        except Exception as exc:
            raise _storage_error(exc) from exc

    def page(
        self,
        path: str,
        *,
        order_by: str,
        descending: bool,
        after: tuple[Any, str] | None,
        limit: int,
    ) -> list[Document]:
        try:
            from google.cloud.firestore_v1 import Query
            from google.cloud.firestore_v1.field_path import FieldPath

            collection = self.client.collection(path)
            direction = Query.DESCENDING if descending else Query.ASCENDING
            query = collection.order_by(order_by, direction=direction).order_by(
                FieldPath.document_id(), direction=direction
            )
            if after is not None:
                cursor_snapshot = collection.document(after[1]).get()
                if not cursor_snapshot.exists:
                    raise ApiError(422, "invalid_page_cursor", "The pagination cursor is invalid.")
                query = query.start_after(cursor_snapshot)
            return [
                Document(document_id=snapshot.id, **snapshot.to_dict())
                for snapshot in query.limit(limit).stream()
            ]
        except ApiError:
            raise
        except Exception as exc:
            raise _storage_error(exc) from exc

    def set(self, path: str, data: dict[str, Any], *, merge: bool = False) -> None:
        try:
            self.client.document(path).set(data, merge=merge)
        except Exception as exc:
            raise _storage_error(exc) from exc

    def update(self, path: str, data: dict[str, Any]) -> None:
        try:
            self.client.document(path).update(data)
        except Exception as exc:
            raise _storage_error(exc) from exc

    def delete(self, path: str) -> None:
        try:
            self.client.document(path).delete()
        except Exception as exc:
            raise _storage_error(exc) from exc

    def delete_collection(self, path: str) -> int:
        """Delete every document under a collection, including nested subcollections.

        Returns the number of documents deleted. Safe to repeat (deleting nothing returns 0).
        """
        try:
            _collection_segments(path)
            return int(self.client.recursive_delete(self.client.collection(path)))
        except Exception as exc:
            raise _storage_error(exc) from exc

    def run_transaction(self, callback: Callable[[Transaction], Any]) -> Any:
        try:
            from google.cloud import firestore

            transaction = self.client.transaction()

            @firestore.transactional
            def run(tx: Any) -> Any:
                return callback(_FirestoreTransaction(self, tx))

            return run(transaction)
        except ApiError:
            raise
        except Exception as exc:
            raise _storage_error(exc) from exc

    def check(self) -> bool:
        try:
            self.client.document("_health/readiness").get()
            return True
        except Exception as exc:
            raise _storage_error(exc) from exc


class _MemoryTransaction:
    def __init__(self, repository: InMemoryRepository):
        self.repository = repository
        self.writes: list[tuple[str, str, dict[str, Any] | None, bool]] = []

    def get(self, path: str) -> Document | None:
        return self.repository.get(path)

    def list(self, path: str, *, filters: tuple[tuple[str, str, Any], ...] = ()) -> list[Document]:
        return self.repository.list(path, filters=filters)

    def set(self, path: str, data: dict[str, Any], *, merge: bool = False) -> None:
        _document_segments(path)
        self.writes.append(("set", path, copy.deepcopy(data), merge))

    def update(self, path: str, data: dict[str, Any]) -> None:
        _document_segments(path)
        self.writes.append(("update", path, copy.deepcopy(data), True))

    def delete(self, path: str) -> None:
        _document_segments(path)
        self.writes.append(("delete", path, None, False))


class InMemoryRepository:
    """Thread-safe Firestore test double. It models document paths and transactions, not emulator semantics."""

    configured = True

    def __init__(self):
        self._documents: dict[str, dict[str, Any]] = {}
        self._lock = RLock()

    def get(self, path: str) -> Document | None:
        _document_segments(path)
        with self._lock:
            data = self._documents.get(path)
            return (
                Document(document_id=_document_segments(path)[-1], **copy.deepcopy(data))
                if data is not None
                else None
            )

    def list(
        self,
        path: str,
        *,
        filters: tuple[tuple[str, str, Any], ...] = (),
        order_by: tuple[str, str] | None = None,
        limit: int | None = None,
    ) -> list[Document]:
        _collection_segments(path)
        prefix = path.strip("/") + "/"
        depth = len(_collection_segments(path)) + 1
        with self._lock:
            documents = [
                Document(document_id=key.rsplit("/", 1)[-1], **copy.deepcopy(value))
                for key, value in self._documents.items()
                if key.startswith(prefix) and len(_segments(key)) == depth
            ]
        for field, operation, value in filters:

            def matches(doc: Document, field=field, operation=operation, value=value) -> bool:
                actual = doc.get(field)
                if operation == "==":
                    return actual == value
                if operation == "!=":
                    return actual != value
                if operation == "<":
                    return actual is not None and actual < value
                if operation == "<=":
                    return actual is not None and actual <= value
                if operation == ">":
                    return actual is not None and actual > value
                if operation == ">=":
                    return actual is not None and actual >= value
                if operation == "in":
                    return actual in value
                return False

            documents = [document for document in documents if matches(document)]
        if order_by:
            field, direction = order_by
            documents.sort(
                key=lambda document: (document.get(field), document.id), reverse=direction.lower() == "desc"
            )
        if limit is not None:
            documents = documents[:limit]
        return documents

    def page(
        self,
        path: str,
        *,
        order_by: str,
        descending: bool,
        after: tuple[Any, str] | None,
        limit: int,
    ) -> list[Document]:
        documents = self.list(path, order_by=(order_by, "desc" if descending else "asc"))
        if after is not None:
            cursor_key = (after[0], after[1])
            if descending:
                documents = [item for item in documents if (item.get(order_by), item.id) < cursor_key]
            else:
                documents = [item for item in documents if (item.get(order_by), item.id) > cursor_key]
        return documents[:limit]

    def set(self, path: str, data: dict[str, Any], *, merge: bool = False) -> None:
        _document_segments(path)
        with self._lock:
            current = self._documents.get(path, {}) if merge else {}
            self._documents[path] = {**current, **copy.deepcopy(data)}

    def update(self, path: str, data: dict[str, Any]) -> None:
        _document_segments(path)
        with self._lock:
            if path not in self._documents:
                raise ApiError(503, "firestore_write_failed", "The requested record could not be updated.")
            self._documents[path].update(copy.deepcopy(data))

    def delete(self, path: str) -> None:
        _document_segments(path)
        with self._lock:
            self._documents.pop(path, None)

    def delete_collection(self, path: str) -> int:
        prefix = "/".join(_collection_segments(path)) + "/"
        with self._lock:
            keys = [key for key in self._documents if key.startswith(prefix)]
            for key in keys:
                del self._documents[key]
            return len(keys)

    def run_transaction(self, callback: Callable[[Transaction], Any]) -> Any:
        with self._lock:
            transaction = _MemoryTransaction(self)
            result = callback(transaction)
            for operation, path, data, merge in transaction.writes:
                if operation == "delete":
                    self._documents.pop(path, None)
                elif operation == "update":
                    if path not in self._documents:
                        raise ApiError(
                            503, "firestore_write_failed", "The requested record could not be updated."
                        )
                    self._documents[path].update(data or {})
                else:
                    current = self._documents.get(path, {}) if merge else {}
                    self._documents[path] = {**current, **(data or {})}
            return result

    def check(self) -> bool:
        return True


def _storage_error(exc: Exception) -> ApiError:
    logger.warning("firestore_operation_failed error_type=%s", type(exc).__name__)
    return ApiError(503, "firestore_unavailable", "The application data store is unavailable.")


def path(*parts: Any) -> str:
    return "/".join(str(part) for part in parts)


def records_with_ids(records: Iterable[Document]) -> list[Document]:
    return list(records)
