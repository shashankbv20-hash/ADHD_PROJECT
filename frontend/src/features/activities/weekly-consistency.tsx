import { CalendarDays } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";

export function WeeklyConsistency({
  data,
}: {
  data: Array<{ day: string; minutes: number }>;
}) {
  const maxMinutes = Math.max(...data.map((item) => item.minutes), 1);
  const totalMinutes = data.reduce((total, item) => total + item.minutes, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Weekly activity</CardTitle>
          <CardDescription>
            Synthetic participation minutes over the last seven days.
          </CardDescription>
        </div>
        <CalendarDays
          aria-hidden="true"
          className="size-5 shrink-0 text-brand-600"
        />
      </CardHeader>

      <CardContent className="flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-2xl font-semibold tracking-tight text-ink">
            {formatDuration(totalMinutes)}
          </p>
          <span className="text-xs text-ink-subtle">total · demo</span>
        </div>

        <div
          role="img"
          aria-label={`Weekly participation chart. ${data
            .map((item) => `${item.day}: ${item.minutes} minutes`)
            .join(", ")}.`}
          className="mt-5 flex h-32 items-end gap-2"
        >
          {data.map((item) => {
            const height =
              item.minutes === 0
                ? 4
                : Math.max((item.minutes / maxMinutes) * 100, 8);

            return (
              <div
                key={item.day}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className="font-mono text-[10px] text-ink-subtle">
                  {item.minutes > 0 ? item.minutes : "—"}
                </span>
                <div
                  className="w-full max-w-9 rounded-t-md bg-brand-500/85"
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] font-medium text-ink-subtle">
                  {item.day}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>

      <div className="border-t border-line/80 px-5 py-3">
        <p className="text-xs text-ink-subtle">
          Participation totals are illustrative and do not measure clinical
          engagement.
        </p>
      </div>
    </Card>
  );
}
