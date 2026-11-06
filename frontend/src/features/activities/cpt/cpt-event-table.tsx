import { Badge } from "@/components/ui/badge";
import { cptOutcomeConfig } from "@/features/activities/cpt/cpt-outcome";
import type { CptTrialEvent } from "@/types";

export function CptEventTable({ events }: { events: CptTrialEvent[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">
          Trial-by-trial CPT events with stimulus, response, reaction time, and
          outcome.
        </caption>
        <thead>
          <tr className="border-b border-line bg-slate-50/70 text-xs uppercase tracking-[0.08em] text-ink-subtle">
            <th scope="col" className="px-4 py-2.5 font-medium">
              Trial
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Stimulus
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Type
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Response
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Reaction time
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Outcome
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const outcome = cptOutcomeConfig[event.outcome];

            return (
              <tr
                key={event.trialId}
                className="border-b border-line/70 last:border-0"
              >
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-ink-muted">
                  {event.trialIndex + 1}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm font-semibold text-ink">
                  {event.stimulus}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <Badge tone={event.isTarget ? "brand" : "neutral"}>
                    {event.isTarget ? "Target" : "Non-target"}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">
                  {event.responded ? "Yes" : "No"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-ink-muted">
                  {event.reactionTimeMs !== null
                    ? `${event.reactionTimeMs} ms`
                    : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <Badge tone={outcome.tone}>{outcome.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
