from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from app.db.base import Base
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column


def uuid_column() -> Mapped[UUID]:
    return mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('participant', 'caregiver', 'clinician', 'researcher')",
            name="role_allowed",
        ),
    )

    id: Mapped[UUID] = uuid_column()
    firebase_uid: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    role: Mapped[str] = mapped_column(String(24), nullable=False, default="participant")
    display_name: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Subject(TimestampMixin, Base):
    __tablename__ = "subjects"
    __table_args__ = (Index("ix_subjects_owner_user_id", "owner_user_id"),)

    id: Mapped[UUID] = uuid_column()
    owner_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    display_label: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class CaregiverRelationship(TimestampMixin, Base):
    __tablename__ = "caregiver_relationships"
    __table_args__ = (
        UniqueConstraint("caregiver_user_id", "subject_id", name="caregiver_subject_once"),
        CheckConstraint("status IN ('active', 'revoked')", name="status_allowed"),
        CheckConstraint(
            "(status = 'active' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL)",
            name="revocation_timestamp_consistent",
        ),
        Index("ix_caregiver_relationships_subject_id", "subject_id"),
    )

    id: Mapped[UUID] = uuid_column()
    caregiver_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    subject_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False
    )
    granted_by_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ConsentRecord(Base):
    __tablename__ = "consent_records"
    __table_args__ = (
        CheckConstraint(
            "scope IN ('research', 'eeg_processing', 'webcam_analysis')",
            name="scope_allowed",
        ),
        CheckConstraint(
            "status IN ('granted', 'withdrawn', 'denied', 'superseded')",
            name="status_allowed",
        ),
        CheckConstraint(
            "(status NOT IN ('granted', 'withdrawn', 'superseded') OR granted_at IS NOT NULL) AND "
            "(status = 'withdrawn' OR withdrawn_at IS NULL) AND "
            "(status != 'withdrawn' OR withdrawn_at IS NOT NULL)",
            name="consent_timestamps_consistent",
        ),
        UniqueConstraint("subject_id", "scope", "idempotency_key", name="consent_idempotency_once"),
        Index(
            "uq_consent_active_scope",
            "subject_id",
            "scope",
            unique=True,
            postgresql_where=text("status = 'granted' AND withdrawn_at IS NULL"),
            sqlite_where=text("status = 'granted' AND withdrawn_at IS NULL"),
        ),
        Index("ix_consent_records_subject_scope", "subject_id", "scope"),
    )

    id: Mapped[UUID] = uuid_column()
    subject_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False
    )
    actor_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    scope: Mapped[str] = mapped_column(String(32), nullable=False)
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    granted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ActivityDefinition(Base):
    __tablename__ = "activity_definitions"
    __table_args__ = (
        CheckConstraint("availability IN ('available', 'planned')", name="availability_allowed"),
    )

    activity_code: Mapped[str] = mapped_column(String(48), primary_key=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    availability: Mapped[str] = mapped_column(String(16), nullable=False)
    estimated_duration_minutes: Mapped[int | None] = mapped_column(SmallInteger)
    activity_version: Mapped[str] = mapped_column(String(64), nullable=False, default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ActivityConfiguration(Base):
    __tablename__ = "activity_configurations"
    __table_args__ = (
        UniqueConstraint("activity_code", "version", name="activity_configuration_version_once"),
        Index("ix_activity_configurations_current", "activity_code", "is_current"),
    )

    id: Mapped[UUID] = uuid_column()
    activity_code: Mapped[str] = mapped_column(
        String(48), ForeignKey("activity_definitions.activity_code", ondelete="RESTRICT"), nullable=False
    )
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    configuration: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Session(TimestampMixin, Base):
    __tablename__ = "sessions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('created', 'active', 'paused', 'completed', 'cancelled')",
            name="status_allowed",
        ),
        UniqueConstraint("created_by_user_id", "idempotency_key", name="session_idempotency_once"),
        CheckConstraint(
            "(status NOT IN ('active', 'paused', 'completed') OR started_at IS NOT NULL) AND "
            "(status != 'completed' OR completed_at IS NOT NULL)",
            name="state_timestamps_consistent",
        ),
        CheckConstraint(
            "(idempotency_key IS NULL AND request_fingerprint IS NULL) OR "
            "(idempotency_key IS NOT NULL AND request_fingerprint IS NOT NULL)",
            name="idempotency_fingerprint_consistent",
        ),
        Index("ix_sessions_subject_created", "subject_id", "created_at"),
    )

    id: Mapped[UUID] = uuid_column()
    subject_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False
    )
    created_by_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="created")
    idempotency_key: Mapped[str | None] = mapped_column(String(128))
    request_fingerprint: Mapped[str | None] = mapped_column(String(64))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SessionActivity(Base):
    __tablename__ = "session_activities"
    __table_args__ = (
        UniqueConstraint("session_id", "position", name="session_activity_position_once"),
        CheckConstraint(
            "status IN ('assigned', 'active', 'paused', 'completed', 'skipped')",
            name="status_allowed",
        ),
        CheckConstraint("mode IN ('practice', 'scored')", name="mode_allowed"),
        CheckConstraint("position >= 1", name="position_positive"),
        CheckConstraint(
            "(status NOT IN ('active', 'paused', 'completed') OR started_at IS NOT NULL) AND "
            "(status NOT IN ('completed', 'skipped') OR completed_at IS NOT NULL)",
            name="state_timestamps_consistent",
        ),
    )

    id: Mapped[UUID] = uuid_column()
    session_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    activity_code: Mapped[str] = mapped_column(
        String(48), ForeignKey("activity_definitions.activity_code", ondelete="RESTRICT"), nullable=False
    )
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="assigned")
    mode: Mapped[str] = mapped_column(String(12), nullable=False, default="scored")
    configuration_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ActivityEvent(Base):
    __tablename__ = "activity_events"
    __table_args__ = (
        UniqueConstraint("session_activity_id", "event_index", name="activity_event_index_once"),
        CheckConstraint("event_index >= 0", name="event_index_nonnegative"),
        Index("ix_activity_events_activity_time", "session_activity_id", "occurred_at"),
    )

    id: Mapped[UUID] = uuid_column()
    session_activity_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("session_activities.id", ondelete="CASCADE"), nullable=False
    )
    event_index: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(String(48), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ActivitySummary(Base):
    __tablename__ = "activity_summaries"
    __table_args__ = (Index("ix_activity_summaries_subject_created", "subject_id", "created_at"),)

    id: Mapped[UUID] = uuid_column()
    session_activity_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("session_activities.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    subject_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False
    )
    activity_code: Mapped[str] = mapped_column(String(48), nullable=False)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    data_provenance: Mapped[str] = mapped_column(String(96), nullable=False)
    calculation_version: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class FeelingCheckIn(Base):
    __tablename__ = "feeling_checkins"
    __table_args__ = (
        UniqueConstraint("session_id", "phase", name="feeling_checkin_session_phase_once"),
        CheckConstraint("phase IN ('pre', 'post')", name="phase_allowed"),
        CheckConstraint("mood_rating BETWEEN 1 AND 5", name="mood_range"),
        CheckConstraint("energy_rating BETWEEN 1 AND 5", name="energy_range"),
    )

    id: Mapped[UUID] = uuid_column()
    session_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    actor_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    phase: Mapped[str] = mapped_column(String(8), nullable=False)
    mood_rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    energy_rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class WebcamFeatureRecord(Base):
    __tablename__ = "webcam_feature_records"
    __table_args__ = (
        CheckConstraint(
            "tracking_confidence >= 0 AND tracking_confidence <= 1",
            name="confidence_range",
        ),
        Index("ix_webcam_features_activity_time", "session_activity_id", "captured_at"),
    )

    id: Mapped[UUID] = uuid_column()
    session_activity_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("session_activities.id", ondelete="CASCADE"), nullable=False
    )
    features: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    tracking_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    processor_version: Mapped[str] = mapped_column(String(64), nullable=False)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class EEGRecording(Base):
    __tablename__ = "eeg_recordings"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'validated', 'rejected', 'processing', 'complete', 'failed')",
            name="status_allowed",
        ),
        CheckConstraint("file_size_bytes > 0", name="file_size_positive"),
        CheckConstraint(
            "sampling_rate_hz IS NULL OR sampling_rate_hz > 0",
            name="sampling_rate_positive",
        ),
        CheckConstraint(
            "channel_count IS NULL OR channel_count > 0",
            name="channel_count_positive",
        ),
        Index("ix_eeg_recordings_subject_created", "subject_id", "created_at"),
    )

    id: Mapped[UUID] = uuid_column()
    subject_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sessions.id", ondelete="SET NULL")
    )
    storage_provider: Mapped[str] = mapped_column(String(48), nullable=False)
    object_key: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sampling_rate_hz: Mapped[float | None] = mapped_column(Float)
    channel_count: Mapped[int | None] = mapped_column(SmallInteger)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    quality: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class EEGPrediction(Base):
    __tablename__ = "eeg_predictions"

    id: Mapped[UUID] = uuid_column()
    recording_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("eeg_recordings.id", ondelete="CASCADE"), nullable=False
    )
    model_version: Mapped[str] = mapped_column(String(128), nullable=False)
    prediction: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    quality: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class DigitalTwinProfile(TimestampMixin, Base):
    __tablename__ = "digital_twin_profiles"
    __table_args__ = (CheckConstraint("current_version >= 0", name="version_nonnegative"),)

    subject_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), primary_key=True
    )
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    profile: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    quality_flags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)


class DigitalTwinHistory(Base):
    __tablename__ = "digital_twin_history"
    __table_args__ = (
        UniqueConstraint("subject_id", "version", name="digital_twin_subject_version_once"),
        CheckConstraint("version >= 1", name="version_positive"),
    )

    id: Mapped[UUID] = uuid_column()
    subject_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    source_summary_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    quality_flags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    algorithm_version: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ReportRecord(Base):
    __tablename__ = "report_records"
    __table_args__ = (
        UniqueConstraint("subject_id", "idempotency_key", name="report_idempotency_once"),
        CheckConstraint(
            "(idempotency_key IS NULL AND request_fingerprint IS NULL) OR "
            "(idempotency_key IS NOT NULL AND request_fingerprint IS NOT NULL)",
            name="idempotency_fingerprint_consistent",
        ),
        Index("ix_report_records_subject_created", "subject_id", "created_at"),
    )

    id: Mapped[UUID] = uuid_column()
    subject_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False
    )
    generated_by_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    idempotency_key: Mapped[str | None] = mapped_column(String(128))
    request_fingerprint: Mapped[str | None] = mapped_column(String(64))
    session_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("sessions.id", ondelete="SET NULL")
    )
    report_type: Mapped[str] = mapped_column(String(64), nullable=False)
    template_version: Mapped[str] = mapped_column(String(64), nullable=False)
    content: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_subject_created", "subject_id", "created_at"),)

    id: Mapped[UUID] = uuid_column()
    actor_user_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    subject_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("subjects.id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(128))
    details: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
