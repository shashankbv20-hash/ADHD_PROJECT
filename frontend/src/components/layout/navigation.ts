import {
  BrainCircuit,
  ClipboardList,
  Database,
  FileText,
  Fingerprint,
  FlaskConical,
  GitCompare,
  History,
  LayoutDashboard,
  ListChecks,
  Network,
  ScanLine,
  Stethoscope,
  TrendingUp,
  UploadCloud,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { WorkspaceRole } from "@/types";

export interface WorkspaceDefinition {
  id: WorkspaceRole;
  label: string;
  href: string;
  icon: LucideIcon;
  demoIdentity: {
    name: string;
    detail: string;
    initials: string;
  };
}

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  status: "available" | "planned";
}

export const workspaces: WorkspaceDefinition[] = [
  {
    id: "participant",
    label: "Participant",
    href: "/participant",
    icon: UserRound,
    demoIdentity: {
      name: "Alex Morgan",
      detail: "Demo participant · ATN-0142",
      initials: "AM",
    },
  },
  {
    id: "clinician",
    label: "Clinician",
    href: "/clinician",
    icon: Stethoscope,
    demoIdentity: {
      name: "Demo clinician",
      detail: "Synthetic roster · no credentials",
      initials: "DC",
    },
  },
  {
    id: "researcher",
    label: "Research",
    href: "/research",
    icon: FlaskConical,
    demoIdentity: {
      name: "Demo researcher",
      detail: "Synthetic datasets · no credentials",
      initials: "DR",
    },
  },
];

export const navigationByWorkspace: Record<WorkspaceRole, NavItem[]> = {
  participant: [
    {
      label: "Overview",
      href: "/participant",
      icon: LayoutDashboard,
      status: "available",
    },
    {
      label: "Session history",
      href: "/participant/sessions",
      icon: History,
      status: "available",
    },
    {
      label: "Upload EEG",
      href: "/participant/upload",
      icon: UploadCloud,
      status: "available",
    },
    {
      label: "Cognitive activities",
      href: "/participant/activities",
      icon: BrainCircuit,
      status: "available",
    },
    {
      label: "Activity history",
      href: "/participant/activities/history",
      icon: ListChecks,
      status: "available",
    },
    {
      label: "Progress",
      href: "/participant/progress",
      icon: TrendingUp,
      status: "available",
    },
    {
      label: "Digital Twin",
      href: "/participant/digital-twin",
      icon: Fingerprint,
      status: "available",
    },
  ],
  clinician: [
    {
      label: "Overview",
      href: "/clinician",
      icon: LayoutDashboard,
      status: "available",
    },
    {
      label: "Participants",
      href: "/clinician/participants",
      icon: Users,
      status: "available",
    },
    {
      label: "Session comparison",
      href: "/clinician/compare",
      icon: GitCompare,
      status: "available",
    },
    { label: "Session review", icon: ScanLine, status: "planned" },
    { label: "Reports", icon: FileText, status: "planned" },
  ],
  researcher: [
    {
      label: "Overview",
      href: "/research",
      icon: FlaskConical,
      status: "available",
    },
    {
      label: "Model comparison",
      href: "/research/models",
      icon: GitCompare,
      status: "available",
    },
    {
      label: "Experiments",
      href: "/research/experiments",
      icon: ClipboardList,
      status: "available",
    },
    {
      label: "Datasets",
      href: "/research/datasets",
      icon: Database,
      status: "available",
    },
    {
      label: "Explainability",
      href: "/research/explainability",
      icon: Network,
      status: "available",
    },
  ],
};

export function getWorkspaceForPath(pathname: string): WorkspaceDefinition {
  return (
    workspaces.find(
      (workspace) =>
        pathname === workspace.href ||
        pathname.startsWith(`${workspace.href}/`),
    ) ?? workspaces[0]
  );
}

const exactRouteTitles: Record<string, string> = {
  "/clinician": "Clinician overview",
  "/clinician/compare": "Session comparison",
  "/research": "Research dashboard",
  "/research/models": "Model comparison",
  "/research/experiments": "Experiments",
  "/research/datasets": "Dataset inventory",
  "/research/explainability": "Explainability",
};

const clinicianParticipantSubrouteTitles = [
  { suffix: "/eeg", title: "EEG analysis" },
  { suffix: "/behavior", title: "Behavioral activity summary" },
  { suffix: "/report", title: "Research report" },
];

const routeTitleOverrides = [
  { prefix: "/participant/upload/processing", title: "Processing" },
  { prefix: "/participant/sessions/", title: "Session record" },
  {
    prefix: "/participant/activities/cpt",
    title: "Continuous Performance Task",
  },
  {
    prefix: "/participant/activities/history/",
    title: "CPT run summary",
  },
  { prefix: "/clinician/participants/", title: "Participant overview" },
  { prefix: "/research/experiments/", title: "Experiment detail" },
];

export function getPageTitle(
  pathname: string,
  workspace: WorkspaceRole,
): string {
  const exactTitle = exactRouteTitles[pathname];

  if (exactTitle) {
    return exactTitle;
  }

  if (pathname.startsWith("/clinician/participants/")) {
    const participantSubroute = clinicianParticipantSubrouteTitles.find(
      ({ suffix }) => pathname.endsWith(suffix),
    );

    if (participantSubroute) {
      return participantSubroute.title;
    }
  }

  const override = routeTitleOverrides.find(({ prefix }) =>
    pathname.startsWith(prefix),
  );

  if (override) {
    return override.title;
  }

  const navItems = navigationByWorkspace[workspace];
  const exactMatch = navItems.find((item) => item.href === pathname);

  if (exactMatch) {
    return exactMatch.label;
  }

  const prefixMatch = navItems
    .filter(
      (item) => item.href && pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];

  return prefixMatch?.label ?? "Overview";
}
