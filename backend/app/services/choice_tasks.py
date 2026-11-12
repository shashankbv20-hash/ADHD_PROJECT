"""Registry of activities whose trials are not simple respond/withhold events.

CPT, Go/No-Go and N-back share the CPT event format. Choice tasks (Stop-Signal, Stroop, and later
ones) each have their own event shape, validation, configuration snapshot and metrics. The session
service looks them up here instead of branching on each activity.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.services import (
    object_tracking,
    planning_puzzle,
    stop_signal,
    stroop,
    task_switching,
    time_perception,
    visual_search,
    visual_sequence,
)


@dataclass(frozen=True)
class ChoiceTask:
    code: str
    validate_event: Callable[[Any, str], dict[str, Any]]
    trial_count: Callable[[str], int]
    snapshot: Callable[[str], dict[str, Any]]
    metrics: Callable[[list[dict[str, Any]]], dict[str, Any]]
    data_provenance: str
    calculation_version: str


CHOICE_TASKS: dict[str, ChoiceTask] = {
    stop_signal.STOP_SIGNAL_CODE: ChoiceTask(
        code=stop_signal.STOP_SIGNAL_CODE,
        validate_event=stop_signal.validate_stop_signal_event,
        trial_count=lambda mode: len(stop_signal.expected_directions(mode)),
        snapshot=stop_signal.configuration_snapshot,
        metrics=stop_signal.calculate_stop_signal_metrics,
        data_provenance=stop_signal.STOP_SIGNAL_DATA_PROVENANCE,
        calculation_version=stop_signal.STOP_SIGNAL_CALCULATION_VERSION,
    ),
    task_switching.TASK_SWITCHING_CODE: ChoiceTask(
        code=task_switching.TASK_SWITCHING_CODE,
        validate_event=task_switching.validate_task_switching_event,
        trial_count=task_switching.trial_count,
        snapshot=task_switching.configuration_snapshot,
        metrics=task_switching.calculate_task_switching_metrics,
        data_provenance=task_switching.TASK_SWITCHING_DATA_PROVENANCE,
        calculation_version=task_switching.TASK_SWITCHING_CALCULATION_VERSION,
    ),
    visual_search.VISUAL_SEARCH_CODE: ChoiceTask(
        code=visual_search.VISUAL_SEARCH_CODE,
        validate_event=visual_search.validate_visual_search_event,
        trial_count=visual_search.trial_count,
        snapshot=visual_search.configuration_snapshot,
        metrics=visual_search.calculate_visual_search_metrics,
        data_provenance=visual_search.VISUAL_SEARCH_DATA_PROVENANCE,
        calculation_version=visual_search.VISUAL_SEARCH_CALCULATION_VERSION,
    ),
    planning_puzzle.PLANNING_PUZZLE_CODE: ChoiceTask(
        code=planning_puzzle.PLANNING_PUZZLE_CODE,
        validate_event=planning_puzzle.validate_planning_puzzle_event,
        trial_count=planning_puzzle.trial_count,
        snapshot=planning_puzzle.configuration_snapshot,
        metrics=planning_puzzle.calculate_planning_puzzle_metrics,
        data_provenance=planning_puzzle.PLANNING_PUZZLE_DATA_PROVENANCE,
        calculation_version=planning_puzzle.PLANNING_PUZZLE_CALCULATION_VERSION,
    ),
    visual_sequence.VISUAL_SEQUENCE_CODE: ChoiceTask(
        code=visual_sequence.VISUAL_SEQUENCE_CODE,
        validate_event=visual_sequence.validate_visual_sequence_event,
        trial_count=visual_sequence.trial_count,
        snapshot=visual_sequence.configuration_snapshot,
        metrics=visual_sequence.calculate_visual_sequence_metrics,
        data_provenance=visual_sequence.VISUAL_SEQUENCE_DATA_PROVENANCE,
        calculation_version=visual_sequence.VISUAL_SEQUENCE_CALCULATION_VERSION,
    ),
    time_perception.TIME_PERCEPTION_CODE: ChoiceTask(
        code=time_perception.TIME_PERCEPTION_CODE,
        validate_event=time_perception.validate_time_perception_event,
        trial_count=time_perception.trial_count,
        snapshot=time_perception.configuration_snapshot,
        metrics=time_perception.calculate_time_perception_metrics,
        data_provenance=time_perception.TIME_PERCEPTION_DATA_PROVENANCE,
        calculation_version=time_perception.TIME_PERCEPTION_CALCULATION_VERSION,
    ),
    object_tracking.OBJECT_TRACKING_CODE: ChoiceTask(
        code=object_tracking.OBJECT_TRACKING_CODE,
        validate_event=object_tracking.validate_object_tracking_event,
        trial_count=object_tracking.trial_count,
        snapshot=object_tracking.configuration_snapshot,
        metrics=object_tracking.calculate_object_tracking_metrics,
        data_provenance=object_tracking.OBJECT_TRACKING_DATA_PROVENANCE,
        calculation_version=object_tracking.OBJECT_TRACKING_CALCULATION_VERSION,
    ),
    stroop.STROOP_CODE: ChoiceTask(
        code=stroop.STROOP_CODE,
        validate_event=stroop.validate_stroop_event,
        trial_count=stroop.trial_count,
        snapshot=stroop.configuration_snapshot,
        metrics=stroop.calculate_stroop_metrics,
        data_provenance=stroop.STROOP_DATA_PROVENANCE,
        calculation_version=stroop.STROOP_CALCULATION_VERSION,
    ),
}
