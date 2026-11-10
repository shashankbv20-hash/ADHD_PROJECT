import { cookies } from "next/headers";
import { isDemoPortalRole, type DemoPortalRole } from "@/features/auth/portal-role";
import { DEMO_ROLE_COOKIE } from "@/lib/demo/demo-session";

export async function getDemoRole(): Promise<DemoPortalRole | null> {
  const store = await cookies();
  const value = store.get(DEMO_ROLE_COOKIE)?.value;
  return isDemoPortalRole(value) ? value : null;
}
