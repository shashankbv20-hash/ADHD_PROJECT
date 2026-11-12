from __future__ import annotations

import re
from datetime import datetime
from typing import Annotated, Any, Literal
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
    trial_index: int = Field(ge=0, le=63)
    trial_id: str = Field(min_length=1, max_length=64)
    stimulus: str = Field(min_length=1, max_length=32)
    is_target: bool
    responded: bool
    reaction_time_ms: int | None = Field(default=None, ge=0, le=2200)
    outcome: CptOutcome | None = None


class StopSignalEventInput(ApiModel):
    trial_index: int = Field(ge=0, le=63)
    trial_id: str = Field(min_length=1, max_length=64)
    stimulus: Literal["L", "R"]
    is_stop: bool
    stop_signal_delay_ms: int | None = Field(default=None, ge=0, le=1000)
    responded: bool
    response_direction: Literal["L", "R"] | None = None
    reaction_time_ms: int | None = Field(default=None, ge=0, le=2200)


class StroopEventInput(ApiModel):
    trial_index: int = Field(ge=0, le=63)
    trial_id: str = Field(min_length=1, max_length=64)
    word: Literal["R", "G", "B", "Y"]
    ink: Literal["R", "G", "B", "Y"]
    responded: bool
    response_color: Literal["R", "G", "B", "Y"] | None = None
    reaction_time_ms: int | None = Field(default=None, ge=0, le=2200)


class TaskSwitchingEventInput(ApiModel):
    trial_index: int = Field(ge=0, le=63)
    trial_id: str = Field(min_length=1, max_length=64)
    rule: Literal["colour", "shape"]
    colour: Literal["R", "B"]
    shape: Literal["O", "Q"]
    responded: bool
    response_side: Literal["L", "R"] | None = None
    reaction_time_ms: int | None = Field(default=None, ge=0, le=2200)


class VisualSearchEventInput(ApiModel):
    trial_index: int = Field(ge=0, le=63)
    trial_id: str = Field(min_length=1, max_length=64)
    set_size: Literal[4, 8, 12]
    target_present: bool
    responded: bool
    response: Literal["present", "absent"] | None = None
    reaction_time_ms: int | None = Field(default=None, ge=0, le=2200)


class PlanningPuzzleEventInput(ApiModel):
    trial_index: int = Field(ge=0, le=63)
    trial_id: str = Field(min_length=1, max_length=64)
    disc_count: Literal[3, 4]
    moves: list[Annotated[str, Field(pattern="^[ABC][ABC]$")]] = Field(max_length=63)
    illegal_attempts: int = Field(ge=0, le=500)
    first_move_latency_ms: int | None = Field(default=None, ge=0, le=300_000)
    total_time_ms: int = Field(ge=0, le=300_000)


class VisualSequenceEventInput(ApiModel):
    trial_index: int = Field(ge=0, le=63)
    trial_id: str = Field(min_length=1, max_length=64)
    sequence_length: int = Field(ge=2, le=9)
    response: list[Annotated[int, Field(ge=0, le=8)]] = Field(max_length=9)
    first_response_latency_ms: int | None = Field(default=None, ge=0, le=60_000)
    total_response_time_ms: int = Field(ge=0, le=120_000)


class TimePerceptionEventInput(ApiModel):
    trial_index: int = Field(ge=0, le=63)
    trial_id: str = Field(min_length=1, max_length=64)
    target_ms: int = Field(ge=500, le=10_000)
    reproduced_ms: int | None = Field(default=None, ge=0, le=30_000)


class ObjectTrackingEventInput(ApiModel):
    trial_index: int = Field(ge=0, le=63)
    trial_id: str = Field(min_length=1, max_length=64)
    object_count: Literal[8]
    target_count: Literal[2, 3, 4]
    selected: list[Annotated[int, Field(ge=0, le=7)]] = Field(max_length=4)
    response_time_ms: int | None = Field(default=None, ge=0, le=60_000)


class EventBatchRequest(ApiModel):
    # Each activity family has different fields (extra fields are forbidden), so each event matches
    # exactly one shape; the session service checks it fits the activity.
    events: list[
        CptEventInput
        | StopSignalEventInput
        | StroopEventInput
        | TaskSwitchingEventInput
        | VisualSearchEventInput
        | PlanningPuzzleEventInput
        | VisualSequenceEventInput
        | TimePerceptionEventInput
        | ObjectTrackingEventInput
    ] = Field(min_length=1, max_length=64)


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


class StopSignalMetricsRead(ApiModel):
    trial_count: int
    go_trial_count: int
    stop_trial_count: int
    go_correct_count: int
    go_wrong_direction_count: int
    go_omission_count: int
    go_accuracy_percent: float | None
    mean_go_reaction_time_ms: int | None
    go_reaction_time_stddev_ms: float | None
    successful_stop_count: int
    failed_stop_count: int
    stop_success_rate_percent: float | None
    mean_stop_signal_delay_ms: int | None
    ssrt_estimate_ms: int | None
    ssrt_reliable: bool
    data_provenance: str
    calculation_version: str


class StroopMetricsRead(ApiModel):
    trial_count: int
    congruent_trial_count: int
    incongruent_trial_count: int
    correct_count: int
    error_count: int
    omission_count: int
    accuracy_percent: float | None
    congruent_accuracy_percent: float | None
    incongruent_accuracy_percent: float | None
    mean_congruent_reaction_time_ms: int | None
    mean_incongruent_reaction_time_ms: int | None
    interference_ms: int | None
    data_provenance: str
    calculation_version: str


class TaskSwitchingMetricsRead(ApiModel):
    trial_count: int
    switch_trial_count: int
    repeat_trial_count: int
    correct_count: int
    error_count: int
    omission_count: int
    accuracy_percent: float | None
    switch_accuracy_percent: float | None
    repeat_accuracy_percent: float | None
    mean_switch_reaction_time_ms: int | None
    mean_repeat_reaction_time_ms: int | None
    switch_cost_ms: int | None
    data_provenance: str
    calculation_version: str


class VisualSearchSizeRead(ApiModel):
    set_size: int
    mean_reaction_time_ms: int | None


class VisualSearchMetricsRead(ApiModel):
    trial_count: int
    target_present_count: int
    target_absent_count: int
    correct_count: int
    error_count: int
    omission_count: int
    accuracy_percent: float | None
    present_accuracy_percent: float | None
    absent_accuracy_percent: float | None
    mean_reaction_time_ms: int | None
    reaction_time_by_set_size: list[VisualSearchSizeRead]
    search_slope_ms_per_item: float | None
    data_provenance: str
    calculation_version: str


class PlanningPuzzleMetricsRead(ApiModel):
    puzzle_count: int
    solved_count: int
    solved_percent: float | None
    optimal_count: int
    total_moves: int
    mean_extra_moves: float | None
    illegal_attempts: int
    mean_planning_time_ms: int | None
    mean_solution_time_ms: int | None
    data_provenance: str
    calculation_version: str


class VisualSequenceMetricsRead(ApiModel):
    trial_count: int
    correct_count: int
    accuracy_percent: float | None
    longest_correct_span: int | None
    correct_position_percent: float | None
    no_response_count: int
    mean_first_response_ms: int | None
    data_provenance: str
    calculation_version: str


class TimePerceptionMetricsRead(ApiModel):
    trial_count: int
    response_count: int
    no_response_count: int
    mean_absolute_error_ms: int | None
    mean_signed_error_ms: int | None
    mean_ratio: float | None
    ratio_variability: float | None
    within_tolerance_count: int
    within_tolerance_percent: float
    data_provenance: str
    calculation_version: str


class ObjectTrackingLoadRead(ApiModel):
    target_count: int
    trial_count: int
    targets_found_percent: float | None


class ObjectTrackingMetricsRead(ApiModel):
    trial_count: int
    perfect_count: int
    perfect_percent: float | None
    targets_found_percent: float | None
    wrong_pick_count: int
    highest_perfect_load: int | None
    by_load: list[ObjectTrackingLoadRead]
    mean_response_time_ms: int | None
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
    metrics: (
        CptMetricsRead
        | StopSignalMetricsRead
        | StroopMetricsRead
        | TaskSwitchingMetricsRead
        | VisualSearchMetricsRead
        | PlanningPuzzleMetricsRead
        | VisualSequenceMetricsRead
        | TimePerceptionMetricsRead
        | ObjectTrackingMetricsRead
    )
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


class SharedSubjectRead(ApiModel):
    """A subject shared with the calling caregiver. Deliberately omits the owner's identifier."""

    subject_id: UUID
    display_label: str | None
    relationship_id: UUID
    shared_since: datetime | None


class SharedSubjectList(ApiModel):
    items: list[SharedSubjectRead]
