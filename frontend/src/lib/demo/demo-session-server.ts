import { cookies } from "next/headers";
import { isPortalRole, type PortalRole } from "@/features/auth/portal-role";
import { DEMO_ROLE_COOKIE } from "@/lib/demo/demo-session";

export async function getDemoRole(): Promise<PortalRole | null> {
  const store = await cookies();
  const value = store.get(DEMO_ROLE_COOKIE)?.value;
  return isPortalRole(value) ? value : null;
}
