from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def to_camel(value: str) -> str:
    return re.sub(r"_([a-z])", lambda match: match.group(1).upper(), value)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class UserRead(ApiModel):
    id: str
    firebase_uid: str
    role: Literal["participant", "caregiver", "clinician", "researcher"]
    display_name: str | None
    created_at: datetime


class UserProfileUpdate(ApiModel):
    display_name: str = Field(min_length=1, max_length=120)


class SubjectCreate(ApiModel):
    display_label: str | None = Field(default=None, max_length=120)


class SubjectUpdate(ApiModel):
    display_label: str | None = Field(default=None, max_length=120)


class SubjectRead(ApiModel):
    id: UUID
    display_label: str | None
    owner_user_id: str
    created_at: datetime
    is_active: bool


class SubjectList(ApiModel):
    items: list[SubjectRead]


class CaregiverRelationshipCreate(ApiModel):
    caregiver_firebase_uid: str = Field(min_length=1, max_length=128)


class CaregiverRelationshipRead(ApiModel):
    id: UUID
    caregiver_user_id: str
    subject_id: UUID
    status: Literal["active", "revoked"]
    created_at: datetime
    revoked_at: datetime | None


class CaregiverRelationshipList(ApiModel):
    items: list[CaregiverRelationshipRead]


ConsentScope = Literal["research", "eeg_processing", "webcam_analysis"]


class ConsentCreate(ApiModel):
    scope: ConsentScope
    version: str = Field(min_length=1, max_length=64)
    idempotency_key: str = Field(min_length=8, max_length=128)


class ConsentRead(ApiModel):
    id: UUID
    subject_id: UUID
    actor_user_id: str
    scope: ConsentScope
    version: str
    idempotency_key: str
    status: Literal["granted", "withdrawn", "denied", "superseded"]
    granted_at: datetime | None
    withdrawn_at: datetime | None
    created_at: datetime


class ConsentList(ApiModel):
    items: list[ConsentRead]


class ActivityDefinitionRead(ApiModel):
    activity_code: str
    title: str
    description: str
    availability: Literal["available", "planned"]
    estimated_duration_minutes: int | None
    activity_version: str


class ActivitySelection(ApiModel):
    activity_code: str = Field(min_length=1, max_length=48)
    mode: Literal["practice", "scored"] = "scored"


class SessionCreate(ApiModel):
    subject_id: UUID
    activities: list[ActivitySelection] = Field(min_length=1, max_length=3)
    idempotency_key: str = Field(min_length=8, max_length=128)

    @field_validator("activities")
    @classmethod
    def require_unique_activity_assignments(
        cls, assignments: list[ActivitySelection]
    ) -> list[ActivitySelection]:
        keys = [(item.activity_code, item.mode) for item in assignments]
        if len(keys) != len(set(keys)):
            raise ValueError("Duplicate activity and mode assignments are not allowed.")
        return assignments


class SessionActivityRead(ApiModel):
    id: UUID
    activity_code: str
    position: int
    status: Literal["assigned", "active", "paused", "completed", "skipped"]
    mode: Literal["practice", "scored"]
    started_at: datetime | None
    completed_at: datetime | None


class SessionRead(ApiModel):
    id: UUID
    subject_id: UUID
    status: Literal["created", "active", "paused", "completed", "cancelled"]
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    activities: list[SessionActivityRead]


class SessionList(ApiModel):
    items: list[SessionRead]
    next_cursor: str | None


CptOutcome = Literal["hit", "miss", "false-alarm", "correct-rejection"]


class CptEventInput(ApiModel):
    trial_index: int = Field(ge=0, le=23)
    trial_id: str = Field(min_length=1, max_length=64)
    stimulus: str = Field(min_length=1, max_length=32)
    is_target: bool
    responded: bool
    reaction_time_ms: int | None = Field(default=None, ge=0, le=1200)
    outcome: CptOutcome | None = None


class EventBatchRequest(ApiModel):
    events: list[CptEventInput] = Field(min_length=1, max_length=24)


class EventBatchResponse(ApiModel):
    accepted_count: int
    duplicate_count: int
    total_event_count: int


class CptBlockMetricRead(ApiModel):
    block: int
    trial_count: int
    accuracy_percent: float
    mean_hit_reaction_time_ms: int | None


class CptMetricsRead(ApiModel):
    trial_count: int
    target_count: int
    non_target_count: int
    response_count: int
    hit_count: int
    miss_count: int
    false_alarm_count: int
    correct_rejection_count: int
    accuracy_percent: int | None
    mean_hit_reaction_time_ms: int | None
    hit_reaction_time_stddev_ms: float | None
    hit_reaction_time_total_ms: int
    valid_reaction_time_count: int
    omission_error_count: int
    commission_error_count: int
    block_metrics: list[CptBlockMetricRead]
    data_provenance: str
    calculation_version: str


class CptAggregateMetricsRead(ApiModel):
    trial_count: int
    target_count: int
    non_target_count: int
    response_count: int
    hit_count: int
    miss_count: int
    false_alarm_count: int
    correct_rejection_count: int
    accuracy_percent: int | None
    mean_hit_reaction_time_ms: int | None
    hit_reaction_time_total_ms: int
    valid_reaction_time_count: int
    omission_error_count: int
    commission_error_count: int
    summary_count: int
    data_provenance: str


class ActivitySummaryRead(ApiModel):
    id: UUID
    session_activity_id: UUID
    subject_id: UUID
    activity_code: str
    metrics: CptMetricsRead
    data_provenance: str
    calculation_version: str
    created_at: datetime


class ActivitySummaryList(ApiModel):
    items: list[ActivitySummaryRead]
    next_cursor: str | None = None


class FeelingCheckInCreate(ApiModel):
    phase: Literal["pre", "post"]
    mood_rating: int = Field(ge=1, le=5)
    energy_rating: int = Field(ge=1, le=5)


class FeelingCheckInRead(ApiModel):
    id: UUID
    session_id: UUID
    phase: Literal["pre", "post"]
    mood_rating: int
    energy_rating: int
    recorded_at: datetime


class ProgressRead(ApiModel):
    subject_id: UUID
    summary_count: int
    aggregate_metrics: CptAggregateMetricsRead | None
    observation_start: datetime | None
    observation_end: datetime | None
    data_provenance: str


class DigitalTwinRead(ApiModel):
    subject_id: UUID
    version: int
    status: Literal["available", "insufficient_data"]
    profile: dict[str, Any]
    quality_flags: list[str]
    updated_at: datetime | None = None


class ReportRead(ApiModel):
    id: UUID
    subject_id: UUID
    session_id: UUID | None
    report_type: str
    template_version: str
    content: dict[str, Any]
    created_at: datetime


class ReportList(ApiModel):
    items: list[ReportRead]


class AiBuddyMessageRequest(ApiModel):
    message: str = Field(min_length=1, max_length=2000)
    subject_id: UUID | None = None
    session_id: UUID | None = None


class ReportCreate(ApiModel):
    session_id: UUID | None = None
    idempotency_key: str = Field(min_length=8, max_length=128)


class DigitalTwinHistoryRead(ApiModel):
    id: UUID
    subject_id: UUID
    version: int
    source_summary_ids: list[str]
    snapshot: dict[str, Any]
    quality_flags: list[str]
    algorithm_version: str
    created_at: datetime


class DigitalTwinHistoryList(ApiModel):
    items: list[DigitalTwinHistoryRead]


class AuditEventRead(ApiModel):
    id: str
    action: str
    resource_type: str
    created_at: datetime | None
    # Whether the participant's own account performed the action. Other people's
    # identifiers are intentionally not exposed.
    actor_is_you: bool
    details: dict[str, Any]


class AuditEventList(ApiModel):
    items: list[AuditEventRead]


class DataErasureRequest(ApiModel):
    # A fixed phrase, so an accidental or scripted call cannot erase data by itself.
    confirmation: Literal["ERASE MY DATA"]


class DataErasureResult(ApiModel):
    subject_id: UUID
    erased_at: datetime
    withdrawn_consent_count: int
    deleted_document_counts: dict[str, int]
