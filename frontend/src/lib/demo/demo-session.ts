import {
  isPortalRole,
  portalRoutes,
  type PortalRole,
} from "@/features/auth/portal-role";

export const DEMO_ROLE_COOKIE = "attune_demo_role";
export const DEMO_ROLE_STORAGE_KEY = "attune.demo.role";
export const DEMO_SESSION_EVENT = "attune:demo-session";

export interface DemoProfile {
  name: string;
  detail: string;
  initials: string;
  href: string;
}

export const demoProfiles: Record<PortalRole, DemoProfile> = {
  participant: {
    name: "Demo Participant",
    detail: "Synthetic participant records · no credentials",
    initials: "DP",
    href: portalRoutes.participant,
  },
  clinician: {
    name: "Demo Clinician",
    detail: "Synthetic roster · no credentials",
    initials: "DC",
    href: portalRoutes.clinician,
  },
  researcher: {
    name: "Demo Researcher",
    detail: "Synthetic datasets · no credentials",
    initials: "DR",
    href: portalRoutes.researcher,
  },
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

export function readDemoRoleCookie(): PortalRole | null {
  const value = readCookie(DEMO_ROLE_COOKIE);
  return isPortalRole(value) ? value : null;
}

export function writeDemoRoleCookie(role: PortalRole): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${DEMO_ROLE_COOKIE}=${encodeURIComponent(role)}; path=/; SameSite=Lax`;
  window.sessionStorage.setItem(DEMO_ROLE_STORAGE_KEY, role);
  window.dispatchEvent(new Event(DEMO_SESSION_EVENT));
}

export function clearDemoRoleCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${DEMO_ROLE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  window.sessionStorage.removeItem(DEMO_ROLE_STORAGE_KEY);
  window.dispatchEvent(new Event(DEMO_SESSION_EVENT));
}
