"use client";

import { ArrowRight, FlaskConical, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDemoAuth } from "@/features/auth/demo-auth-provider";
import {
  portalLabels,
  portalRoutes,
  type DemoPortalRole,
} from "@/features/auth/portal-role";
import { demoProfiles } from "@/lib/demo/demo-session";

function isRouteForRole(pathname: string, role: DemoPortalRole): boolean {
  const route = portalRoutes[role];
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function DemoPortalGate({
  role,
  children,
}: {
  role: DemoPortalRole;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const demo = useDemoAuth();
  const profile = demoProfiles[role];

  function exitDemo() {
    demo.exitDemoSession();
    router.replace("/login");
    router.refresh();
  }

  if (!isRouteForRole(pathname, role)) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>This demo session belongs to another portal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert tone="warning" title="Portal access is isolated">
            You are exploring as {portalLabels[role]}. This demo session cannot
            open records from another workspace.
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push(portalRoutes[role])}>
              Open {portalLabels[role]} demo
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
            <Button variant="outline" onClick={exitDemo}>
              <LogOut aria-hidden="true" className="size-4" />
              Exit demo
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-demo-line bg-demo-soft px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <FlaskConical aria-hidden="true" className="size-4 shrink-0 text-demo" />
          <p className="text-sm font-semibold text-demo">
            Demo mode · {profile.name}
          </p>
          <span className="hidden text-xs text-ink-muted sm:inline">
            {profile.detail}
          </span>
        </div>
        <button
          type="button"
          onClick={exitDemo}
          className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-demo underline decoration-demo-line underline-offset-2 hover:decoration-demo"
        >
          <LogOut aria-hidden="true" className="size-3.5" />
          Exit demo
        </button>
      </div>
      {children}
    </div>
  );
}
