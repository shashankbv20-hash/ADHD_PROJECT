export type PortalRole = "participant" | "caregiver" | "clinician" | "researcher";

/**
 * Demo sessions use synthetic profiles that exist only for these roles. There is
 * no demo caregiver: caregiver access is a real, consented relationship that
 * cannot be meaningfully simulated.
 */
export type DemoPortalRole = Exclude<PortalRole, "caregiver">;

export const portalRoutes: Record<PortalRole, string> = {
  participant: "/participant",
  caregiver: "/caregiver",
  clinician: "/clinician",
  researcher: "/research",
};

export const portalLabels: Record<PortalRole, string> = {
  participant: "Participant",
  caregiver: "Caregiver",
  clinician: "Clinician",
  researcher: "Research",
};

export function isPortalRole(value: unknown): value is PortalRole {
  return (
    value === "participant" ||
    value === "caregiver" ||
    value === "clinician" ||
    value === "researcher"
  );
}

export function isDemoPortalRole(value: unknown): value is DemoPortalRole {
  return isPortalRole(value) && value !== "caregiver";
}
