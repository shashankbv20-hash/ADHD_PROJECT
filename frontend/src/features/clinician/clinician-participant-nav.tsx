"use client";

import {
  Activity,
  FileText,
  LayoutDashboard,
  Waves,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const participantSections: Array<{
  segment: string;
  label: string;
  icon: LucideIcon;
}> = [
  { segment: "", label: "Overview", icon: LayoutDashboard },
  { segment: "eeg", label: "EEG", icon: Waves },
  { segment: "behavior", label: "Behavior", icon: Activity },
  { segment: "report", label: "Report", icon: FileText },
];

export function ClinicianParticipantNav({
  participantId,
  className,
}: {
  participantId: string;
  className?: string;
}) {
  const pathname = usePathname();
  const basePath = `/clinician/participants/${participantId}`;

  return (
    <nav
      aria-label="Participant clinician sections"
      className={cn(
        "flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-card print:hidden",
        className,
      )}
    >
      {participantSections.map(({ segment, label, icon: Icon }) => {
        const href = segment ? `${basePath}/${segment}` : basePath;
        const active = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              active
                ? "bg-ink text-white"
                : "text-ink-muted hover:bg-slate-100 hover:text-ink",
            )}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
