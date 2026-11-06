import type {
  ActivitySummary,
  BandPowerPoint,
  DemoMeta,
  DigitalTwinTrait,
  EegSession,
  FocusTrendPoint,
  ParticipantDashboard,
  ParticipantProfile,
} from "@/types";

export const DEMO_PARTICIPANT_ID = "demo-participant-001";

export const participantDemoMeta: DemoMeta = {
  isDemo: true,
  label: "Demonstration workspace",
  note: "Synthetic demo data for interface review. Not a real participant, EEG recording, or clinical result.",
  snapshotDate: "2026-10-27",
};

export const demoParticipant: ParticipantProfile = {
  id: DEMO_PARTICIPANT_ID,
  displayName: "Alex Morgan",
  initials: "AM",
  ageBand: "18–24",
  memberSince: "2026-05-12",
  researchCode: "ATN-0142",
};

export const demoFocusTrend: FocusTrendPoint[] = [
  { session: "S-01", focusIndex: 54 },
  { session: "S-02", focusIndex: 58 },
  { session: "S-03", focusIndex: 57 },
  { session: "S-04", focusIndex: 63 },
  { session: "S-05", focusIndex: 61 },
  { session: "S-06", focusIndex: 66 },
  { session: "S-07", focusIndex: 64 },
  { session: "S-08", focusIndex: 68 },
];

export const demoBandPower: BandPowerPoint[] = [
  { band: "Delta", relativePower: 18 },
  { band: "Theta", relativePower: 24 },
  { band: "Alpha", relativePower: 31 },
  { band: "Beta", relativePower: 27 },
];

export const demoSessions: EegSession[] = [
  {
    id: "S-2410",
    recordedAt: "2026-10-24T09:15:00Z",
    protocol: "Continuous performance task",
    durationMinutes: 22,
    signalQuality: 96,
    focusIndex: 71,
    status: "analyzed",
    isDemo: true,
  },
  {
    id: "S-2409",
    recordedAt: "2026-10-20T16:40:00Z",
    protocol: "Resting state, eyes open",
    durationMinutes: 18,
    signalQuality: 94,
    focusIndex: 66,
    status: "analyzed",
    isDemo: true,
  },
  {
    id: "S-2408",
    recordedAt: "2026-10-16T11:05:00Z",
    protocol: "Working memory challenge",
    durationMinutes: 26,
    signalQuality: 89,
    focusIndex: 64,
    status: "needs-review",
    isDemo: true,
  },
  {
    id: "S-2407",
    recordedAt: "2026-10-12T14:25:00Z",
    protocol: "Resting state, eyes closed",
    durationMinutes: 20,
    signalQuality: 97,
    focusIndex: null,
    status: "processing",
    isDemo: true,
  },
  {
    id: "S-2406",
    recordedAt: "2026-10-08T10:30:00Z",
    protocol: "Flanker task",
    durationMinutes: 24,
    signalQuality: 92,
    focusIndex: 61,
    status: "analyzed",
    isDemo: true,
  },
  {
    id: "S-2405",
    recordedAt: "2026-10-03T15:50:00Z",
    protocol: "Continuous performance task",
    durationMinutes: 21,
    signalQuality: 71,
    focusIndex: null,
    status: "failed",
    isDemo: true,
  },
];

export const demoTwinTraits: DigitalTwinTrait[] = [
  {
    id: "attention-stability",
    label: "Attention stability",
    value: 72,
    max: 100,
    description:
      "Illustrative consistency score derived from synthetic session summaries.",
  },
  {
    id: "impulse-regulation",
    label: "Impulse regulation",
    value: 64,
    max: 100,
    description:
      "Illustrative response-control indicator. Not a clinical assessment.",
  },
  {
    id: "working-memory",
    label: "Working memory",
    value: 69,
    max: 100,
    description:
      "Illustrative activity score. Demo data only, with no diagnostic meaning.",
  },
  {
    id: "error-recovery",
    label: "Recovery after errors",
    value: 74,
    max: 100,
    description:
      "Illustrative measure of post-error adjustment in synthetic tasks.",
  },
];

export const demoActivities: ActivitySummary[] = [
  {
    id: "ACT-031",
    title: "Sustained attention",
    completedAt: "2026-10-25T10:10:00Z",
    durationMinutes: 8,
    accuracy: 82,
    status: "completed",
  },
  {
    id: "ACT-030",
    title: "Visual working memory",
    completedAt: "2026-10-23T17:30:00Z",
    durationMinutes: 6,
    accuracy: null,
    status: "in-progress",
  },
  {
    id: "ACT-029",
    title: "Response inhibition",
    completedAt: "2026-10-19T09:45:00Z",
    durationMinutes: 10,
    accuracy: 76,
    status: "completed",
  },
];

export const demoWeeklyConsistency = [
  { day: "Mon", minutes: 18 },
  { day: "Tue", minutes: 26 },
  { day: "Wed", minutes: 12 },
  { day: "Thu", minutes: 30 },
  { day: "Fri", minutes: 22 },
  { day: "Sat", minutes: 8 },
  { day: "Sun", minutes: 0 },
];

export const demoParticipantDashboard: ParticipantDashboard = {
  meta: participantDemoMeta,
  participant: demoParticipant,
  stats: [
    {
      id: "sessions",
      label: "Sessions analyzed",
      value: "12",
      delta: "+3 this month",
      deltaDirection: "up",
      description:
        "Synthetic sessions marked complete in this demonstration workspace.",
    },
    {
      id: "signal-quality",
      label: "Median signal quality",
      value: "94",
      unit: "%",
      delta: "+2 pts vs. prior 6",
      deltaDirection: "up",
      description:
        "Illustrative quality score across synthetic recordings. Not a measurement of EEG hardware.",
    },
    {
      id: "focus-index",
      label: "Focus index",
      value: "68",
      unit: "/100",
      delta: "+5 pts over 8 sessions",
      deltaDirection: "up",
      description:
        "An illustrative composite from demo session summaries. It is not a validated clinical measure.",
    },
    {
      id: "activities",
      label: "Activities completed",
      value: "9",
      delta: "2 in progress",
      deltaDirection: "flat",
      description:
        "Cognitive activity records shown for interface demonstration only.",
    },
  ],
  focusTrend: demoFocusTrend,
  bandPower: demoBandPower,
  recentSessions: demoSessions.slice(0, 3),
  twinTraits: demoTwinTraits,
  activities: demoActivities,
  weeklyConsistency: demoWeeklyConsistency,
};
