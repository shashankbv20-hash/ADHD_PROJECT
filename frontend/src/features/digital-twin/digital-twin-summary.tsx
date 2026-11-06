import { ArrowRight, Fingerprint } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { InfoTooltip } from "@/components/ui/tooltip";
import type { DigitalTwinTrait } from "@/types";

export function DigitalTwinSummary({
  traits,
  participantName,
  initials,
  researchCode,
}: {
  traits: DigitalTwinTrait[];
  participantName: string;
  initials: string;
  researchCode: string;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Digital Twin snapshot</CardTitle>
          <CardDescription>
            Illustrative traits. The research profile uses recorded CPT
            measurements.
          </CardDescription>
        </div>
        <Badge tone="accent">Preview</Badge>
      </CardHeader>

      <CardContent className="flex-1 space-y-5">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-slate-50/70 p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {participantName}
            </p>
            <p className="truncate font-mono text-[11px] text-ink-subtle">
              {researchCode} · demo profile
            </p>
          </div>
          <Fingerprint
            aria-hidden="true"
            className="ml-auto size-5 shrink-0 text-brand-600"
          />
        </div>

        <div className="space-y-4">
          {traits.map((trait) => (
            <div key={trait.id}>
              <div className="flex items-center gap-1.5">
                <Progress
                  value={trait.value}
                  max={trait.max}
                  label={trait.label}
                  className="flex-1"
                />
                <InfoTooltip label={trait.description} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex-wrap">
        <p className="text-xs text-ink-subtle">
          Illustrative preview. Profile editing is unavailable.
        </p>
        <Link
          href="/participant/digital-twin"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
        >
          Open research profile
          <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
      </CardFooter>
    </Card>
  );
}
