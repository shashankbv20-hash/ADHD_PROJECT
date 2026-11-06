import type { ReactNode } from "react";

export function MetadataList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="divide-y divide-line/70">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
        >
          <dt className="text-xs text-ink-subtle">{item.label}</dt>
          <dd className="min-w-0 text-right text-xs font-medium text-ink">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
