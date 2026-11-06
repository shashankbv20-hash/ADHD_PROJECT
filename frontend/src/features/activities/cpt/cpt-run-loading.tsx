import { Skeleton } from "@/components/ui/skeleton";

export function CptRunLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading CPT run summary</span>

      <div className="space-y-3 border-b border-line pb-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-[520px] w-full rounded-xl" />
    </div>
  );
}
