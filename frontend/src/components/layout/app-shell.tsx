"use client";

import {
  Check,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo, LogoMark } from "@/components/layout/logo";
import {
  getPageTitle,
  getWorkspaceForPath,
  navigationByWorkspace,
  workspaces,
  type WorkspaceDefinition,
} from "@/components/layout/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDemoAuth } from "@/features/auth/demo-auth-provider";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import { portalLabels, type PortalRole } from "@/features/auth/portal-role";
import { demoProfiles } from "@/lib/demo/demo-session";

function SidebarPanel({
  workspace,
  pathname,
  onNavigate,
  providerMode,
  firebaseDisplayName,
  demoRole,
  onExitDemo,
}: {
  workspace: WorkspaceDefinition;
  pathname: string;
  onNavigate: () => void;
  providerMode: "demo" | "remote" | "firebase" | "invalid";
  firebaseDisplayName: string | null;
  demoRole: PortalRole | null;
  onExitDemo: () => void;
}) {
  const isDemoProvider = providerMode === "demo";
  const navItems = navigationByWorkspace[workspace.id];
  const demoIdentity = demoRole ? demoProfiles[demoRole] : workspace.demoIdentity;
  const visibleWorkspaces = demoRole
    ? workspaces.filter((item) => item.id === demoRole)
    : providerMode === "firebase"
      ? workspaces.filter((item) => item.id === "participant")
      : workspaces;

  return (
    <div className="flex min-h-full flex-col gap-6">
      <div>
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-1.5">
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Workspace
          </p>
          <div className="space-y-0.5">
            {visibleWorkspaces.map((item) => {
              const active = item.id === workspace.id;
              const Icon = item.icon;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-brand-600/20 text-white ring-1 ring-inset ring-brand-400/30"
                      : "text-white/60 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  <span>{item.label}</span>
                  {active ? (
                    <Check
                      aria-hidden="true"
                      className="ml-auto size-3.5 text-brand-300"
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>

        <nav aria-label={`${workspace.label} workspace`} className="mt-6">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Navigation
          </p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;

              if (item.status === "planned" || !item.href) {
                return (
                  <span
                    key={item.label}
                    aria-disabled="true"
                    className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-white/30"
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    <span>{item.label}</span>
                    <span className="ml-auto rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35">
                      Soon
                    </span>
                  </span>
                );
              }

              const active =
                item.href === workspace.href
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-300"
                    />
                  ) : null}
                  <Icon aria-hidden="true" className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <div className="mt-auto space-y-3">
        {isDemoProvider ? (
          <>
            <div className="rounded-xl border border-demo-line/25 bg-demo/10 p-3">
              <div className="flex items-center gap-2 text-demo">
                <FlaskConical aria-hidden="true" className="size-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                  Demo workspace
                </p>
              </div>
              <p className="mt-1.5 text-[11px] leading-5 text-white/45">
                All records and metrics are synthetic.{" "}
                <Link
                  href="/#research-transparency"
                  onClick={onNavigate}
                  className="text-white/70 underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
                >
                  Read the data policy
                </Link>
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-[11px] font-semibold text-brand-100 ring-1 ring-inset ring-white/10">
                  {demoIdentity.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-white">
                    {demoIdentity.name}
                  </p>
                  <p className="truncate text-[10px] text-white/40">
                    {demoIdentity.detail}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onExitDemo}
                className="mt-3 inline-flex items-center gap-1.5 rounded text-[11px] text-white/40 transition-colors hover:text-white"
              >
                <LogOut aria-hidden="true" className="size-3.5" />
                Exit demo
              </button>
            </div>
          </>
        ) : providerMode === "firebase" ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <p className="truncate text-xs font-medium text-white">
              {firebaseDisplayName ?? "Participant account"}
            </p>
            <p className="mt-1 text-[10px] text-white/45">
              Firebase participant · private data
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
              {providerMode === "remote"
                ? "Remote provider selected"
                : "Provider configuration invalid"}
            </p>
            <p className="mt-1.5 text-[11px] leading-5 text-white/45">
              {providerMode === "remote"
                ? "Workspace data is unavailable until backend contracts are confirmed. Demo records are hidden."
                : "Check the public frontend provider configuration. Demo records are not shown."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AppShell({
  children,
  providerMode,
  demoRole = null,
}: {
  children: ReactNode;
  providerMode: "demo" | "remote" | "firebase" | "invalid";
  demoRole?: PortalRole | null;
}) {
  const auth = useFirebaseAuth();
  const demo = useDemoAuth();
  const router = useRouter();
  const isDemoProvider = providerMode === "demo";
  const pathname = usePathname();
  const isFirebaseStaffRoute =
    providerMode === "firebase" && !demoRole &&
    (pathname.startsWith("/clinician") || pathname.startsWith("/research"));
  const workspace = demoRole
    ? workspaces.find((entry) => entry.id === demoRole) ?? workspaces[0]
    : providerMode === "firebase"
      ? workspaces.find((entry) => entry.id === "participant") ?? workspaces[0]
      : getWorkspaceForPath(pathname);
  const pageTitle = isFirebaseStaffRoute
    ? "Staff workspace unavailable"
    : getPageTitle(pathname, workspace.id);
  const firebaseDisplayName = auth.account?.profile.displayName ?? null;
  const demoIdentity = demoRole ? demoProfiles[demoRole] : workspace.demoIdentity;
  const exitDemo = () => {
    demo.exitDemoSession();
    router.replace("/login");
    router.refresh();
  };
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const drawer = drawerRef.current;
    const focusableElements = drawer
      ? Array.from(
          drawer.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled])',
          ),
        )
      : [];

    focusableElements[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || focusableElements.length === 0) {
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previousFocus?.focus();
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-canvas print:bg-white">
      <a href="#main-content" className="skip-link print:hidden">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col border-r border-white/5 bg-ink shadow-sidebar print:hidden lg:flex">
        <div className="px-5 pb-2 pt-5">
          <Logo onDark />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-4">
          <SidebarPanel
            workspace={workspace}
            pathname={pathname}
            onNavigate={() => setOpen(false)}
            providerMode={providerMode}
            firebaseDisplayName={firebaseDisplayName}
            demoRole={demoRole}
            onExitDemo={exitDemo}
          />
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 print:hidden lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink/55 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col bg-ink shadow-sidebar"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <Logo onDark />
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              <SidebarPanel
                workspace={workspace}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
                providerMode={providerMode}
                firebaseDisplayName={firebaseDisplayName}
                demoRole={demoRole}
                onExitDemo={exitDemo}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="print:pl-0 lg:pl-[272px]">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur print:hidden supports-[backdrop-filter]:bg-canvas/70">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                ref={menuButtonRef}
                type="button"
                aria-label="Open navigation"
                aria-expanded={open}
                onClick={() => setOpen(true)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted shadow-sm transition-colors hover:text-ink lg:hidden"
              >
                <Menu aria-hidden="true" className="size-5" />
              </button>
              <div className="flex min-w-0 items-center gap-2 md:hidden">
                <LogoMark className="size-7" />
                <span className="truncate text-sm font-semibold text-ink">
                  {pageTitle}
                </span>
              </div>
              <div className="hidden items-center gap-2 text-sm md:flex">
                <span className="text-ink-subtle">{workspace.label}</span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 text-line-strong"
                />
                <span className="font-medium text-ink">{pageTitle}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden sm:block">
                <Badge
                  tone={
                    providerMode === "invalid"
                      ? "danger"
                      : providerMode === "firebase"
                        ? "brand"
                        : "warning"
                  }
                  dot
                >
                  {providerMode === "demo"
                    ? demoRole
                      ? `Demo ${portalLabels[demoRole].toLowerCase()}`
                      : "Demo data"
                    : providerMode === "remote"
                      ? "Remote unavailable"
                      : providerMode === "firebase"
                        ? "Firebase participant"
                        : "Configuration error"}
                </Badge>
              </div>
              <Link
                href="/#research-transparency"
                aria-label="Read the research data policy"
                className="flex size-9 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-slate-100 hover:text-ink"
              >
                <CircleHelp aria-hidden="true" className="size-5" />
              </Link>
              {isDemoProvider ? (
                <div className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-1 shadow-sm sm:pr-2.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-brand-700 text-[10px] font-semibold text-white">
                    {demoIdentity.initials}
                  </span>
                  <span className="hidden max-w-32 truncate text-xs font-medium text-ink sm:block">
                    {demoIdentity.name}
                  </span>
                </div>
              ) : providerMode === "firebase" && firebaseDisplayName ? (
                <div className="hidden max-w-40 truncate rounded-full border border-line bg-surface px-3 py-2 text-xs font-medium text-ink sm:block">
                  {firebaseDisplayName}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1400px] px-4 py-6 print:max-w-none print:px-0 print:py-0 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>

        <footer className="mx-auto w-full max-w-[1400px] px-4 pb-8 print:hidden sm:px-6 lg:px-8">
          <p className="border-t border-line pt-4 text-xs leading-5 text-ink-subtle">
            {isDemoProvider
              ? "Attune is a research prototype, not a diagnostic or treatment device. Workspace records, metrics, and signals are synthetic demonstration data."
              : providerMode === "remote"
                ? "Remote provider mode is unavailable until backend contracts are confirmed. No demonstration records are displayed or substituted."
                : providerMode === "firebase"
                  ? "Firebase mode enforces verified roles. Participant data is shown only to the signed-in participant; staff data integration is not yet available."
                  : "Frontend provider configuration is invalid. No demonstration records are displayed or substituted."}
          </p>
        </footer>
      </div>
    </div>
  );
}
