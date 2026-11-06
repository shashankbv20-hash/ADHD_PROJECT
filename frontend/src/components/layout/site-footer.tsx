import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";

const workspaceLinks = [
  { label: "Participant portal", href: "/participant" },
  { label: "Clinician portal", href: "/clinician" },
  { label: "Research portal", href: "/research" },
];

const researchLinks = [
  { label: "Research purpose", href: "/#research-transparency" },
  { label: "Platform overview", href: "/#platform" },
  { label: "Workflow", href: "/#workflow" },
  { label: "Sign in", href: "/login" },
];

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="max-w-sm">
            <Logo onDark />
            <p className="mt-4 text-sm leading-6 text-white/55">
              A research workspace for EEG sessions, cognitive activities, and
              digital twin profiles in ADHD research.
            </p>
            <p className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-5 text-white/45">
              Research prototype only. Not a diagnostic or treatment device.
            </p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
              Workspaces
            </h2>
            <ul className="mt-4 space-y-2.5">
              {workspaceLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
              Research
            </h2>
            <ul className="mt-4 space-y-2.5">
              {researchLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Attune research prototype</p>
          <p className="inline-flex items-center gap-1.5">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            Synthetic demonstration data only
          </p>
        </div>
      </div>
    </footer>
  );
}
