export type PortalRole = "participant" | "clinician" | "researcher";

export const portalRoutes: Record<PortalRole, string> = {
  participant: "/participant",
  clinician: "/clinician",
  researcher: "/research",
};

export const portalLabels: Record<PortalRole, string> = {
  participant: "Participant",
  clinician: "Clinician",
  researcher: "Research",
};

export function isPortalRole(value: unknown): value is PortalRole {
  return value === "participant" || value === "clinician" || value === "researcher";
}
