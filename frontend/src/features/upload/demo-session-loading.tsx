import { Skeleton } from "@/components/ui/skeleton";

export function DemoSessionLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading demo session</span>

      <div className="space-y-3 border-b border-line pb-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-16 w-full rounded-xl" />

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Skeleton className="h-[420px] rounded-xl" />
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    </div>
  );
}
