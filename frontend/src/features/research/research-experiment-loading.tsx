export function ResearchExperimentLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading experiment detail"
      className="space-y-6"
    >
      <span className="sr-only">Loading experiment detail…</span>

      <div className="space-y-3">
        <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-full max-w-md animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-slate-100" />
        <div className="flex gap-2">
          <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
        </div>
      </div>

      <div className="h-20 animate-pulse rounded-xl border border-line bg-slate-50" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl border border-line bg-surface"
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="h-80 animate-pulse rounded-xl border border-line bg-surface" />
        <div className="h-80 animate-pulse rounded-xl border border-line bg-surface" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl border border-line bg-surface" />
        <div className="h-64 animate-pulse rounded-xl border border-line bg-surface" />
      </div>
    </div>
  );
}
