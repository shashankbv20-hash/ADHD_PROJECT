"use client";

import {
  ArrowLeft,
  CircleSlash2,
  Database,
  FileWarning,
  HardDrive,
  Layers,
  Search,
  SearchX,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ResearchMetricCard } from "@/features/research/research-metric-card";
import {
  ResearchAvailabilityRow,
  ResearchDetailRow,
} from "@/features/research/research-rows";
import { researchDatasetAvailabilityConfig } from "@/features/research/research-status";
import { cn } from "@/lib/utils";
import type {
  DemoMeta,
  ResearchDataset,
  ResearchDatasetAvailability,
} from "@/types";

type AvailabilityFilter = "all" | ResearchDatasetAvailability;

const availabilityFilters: Array<{
  value: AvailabilityFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "demo-fixture", label: "Demo fixture" },
  { value: "session-only", label: "Session only" },
  { value: "demo-metadata", label: "Metadata only" },
  { value: "unavailable", label: "Unavailable" },
];

function formatCount(value: number | null): string {
  return value === null ? "Not documented" : String(value);
}

export function ResearchDatasetInventory({
  datasets,
  meta,
}: {
  datasets: ResearchDataset[];
  meta: DemoMeta;
}) {
  const [query, setQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>("all");

  const normalizedQuery = query.trim().toLowerCase();

  const filteredDatasets = useMemo(
    () =>
      datasets.filter((dataset) => {
        const matchesAvailability =
          availabilityFilter === "all" ||
          dataset.availability === availabilityFilter;
        const searchableValues = [
          dataset.id,
          dataset.name,
          dataset.modality,
          dataset.description,
          dataset.intendedUse,
          dataset.source,
          dataset.provenance,
          researchDatasetAvailabilityConfig[dataset.availability].label,
          ...dataset.formats,
          ...dataset.limitations,
        ];
        const matchesQuery =
          !normalizedQuery ||
          searchableValues.some((value) =>
            value.toLowerCase().includes(normalizedQuery),
          );

        return matchesAvailability && matchesQuery;
      }),
    [availabilityFilter, datasets, normalizedQuery],
  );

  const countFor = (value: AvailabilityFilter) =>
    value === "all"
      ? datasets.length
      : datasets.filter((dataset) => dataset.availability === value).length;

  const localVerifiedCount = datasets.filter(
    (dataset) => dataset.localFileVerified,
  ).length;
  const sessionOnlyCount = datasets.filter(
    (dataset) => dataset.availability === "session-only",
  ).length;
  const metadataOnlyCount = datasets.filter(
    (dataset) => dataset.availability === "demo-metadata",
  ).length;

  function resetFilters() {
    setAvailabilityFilter("all");
    setQuery("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research workspace"
        title="Dataset inventory"
        description="Review synthetic dataset metadata, availability labels, intended use, format hints, and explicit file-verification states."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" dot>
              Metadata-only inventory
            </Badge>
            <span className="text-xs text-ink-subtle">
              {datasets.length} dataset{datasets.length === 1 ? "" : "s"} ·{" "}
              {localVerifiedCount} verified local file
              {localVerifiedCount === 1 ? "" : "s"}
            </span>
          </div>
        }
        actions={
          <ButtonLink href="/research" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Research dashboard
          </ButtonLink>
        }
      />

      <DemoNotice meta={meta} />

      <Alert tone="warning" title="No verified local dataset files">
        Dataset entries describe synthetic fixtures or metadata labels. No local
        file has been verified, and this interface cannot read, import, upload,
        download, or inspect dataset contents.
      </Alert>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ResearchMetricCard
          icon={Database}
          label="Dataset records"
          value={String(datasets.length)}
          detail="Synthetic metadata entries."
        />
        <ResearchMetricCard
          icon={HardDrive}
          label="Verified local files"
          value={String(localVerifiedCount)}
          detail="No file verification has occurred."
        />
        <ResearchMetricCard
          icon={Layers}
          label="Session-only"
          value={String(sessionOnlyCount)}
          detail="Available only in the current browser session."
        />
        <ResearchMetricCard
          icon={CircleSlash2}
          label="Metadata only"
          value={String(metadataOnlyCount)}
          detail="No signal or file contents are available."
        />
      </dl>

      <Card>
        <CardHeader>
          <CardTitle>Dataset inventory</CardTitle>
          <CardDescription>
            Search by name, modality, source, format, intended use, or
            limitation. Filter by documented availability.
          </CardDescription>
        </CardHeader>

        {datasets.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={Database}
              title="No dataset records"
              description="No dataset metadata is available. No file counts, participant counts, or local files are inferred."
              action={
                <ButtonLink href="/research" variant="outline">
                  Back to research dashboard
                </ButtonLink>
              }
            />
          </CardContent>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div
                role="group"
                aria-label="Filter datasets by availability"
                className="flex flex-wrap gap-1.5"
              >
                {availabilityFilters.map((option) => {
                  const active = availabilityFilter === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setAvailabilityFilter(option.value)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-surface text-ink-muted hover:border-line-strong hover:bg-slate-50",
                      )}
                    >
                      {option.label}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none",
                          active
                            ? "bg-white/15 text-white"
                            : "bg-slate-100 text-ink-subtle",
                        )}
                      >
                        {countFor(option.value)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full lg:max-w-xs">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search datasets"
                  aria-label="Search datasets"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="border-b border-line px-5 py-2.5">
              <p aria-live="polite" className="text-xs text-ink-subtle">
                Showing {filteredDatasets.length} of {datasets.length} dataset
                {datasets.length === 1 ? "" : "s"}.
              </p>
            </div>

            {filteredDatasets.length === 0 ? (
              <CardContent className="py-6">
                <EmptyState
                  icon={SearchX}
                  title="No matching datasets"
                  description="No synthetic dataset records match the current search and availability filter. Adjust the query or clear the filters."
                  action={
                    <Button variant="outline" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  }
                />
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <caption className="sr-only">
                    Synthetic dataset inventory with availability and file
                    verification states
                  </caption>
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-subtle">
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Dataset
                      </th>
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Modality
                      </th>
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Source
                      </th>
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Availability
                      </th>
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Local file
                      </th>
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Participants
                      </th>
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Samples
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDatasets.map((dataset) => {
                      const availability =
                        researchDatasetAvailabilityConfig[dataset.availability];

                      return (
                        <tr
                          key={dataset.id}
                          className="border-b border-line/70 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="px-5 py-3">
                            <p className="text-sm font-medium text-ink">
                              {dataset.name}
                            </p>
                            <p className="font-mono text-[10px] text-ink-subtle">
                              {dataset.id}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-ink-muted">
                            {dataset.modality}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-ink-muted">
                            {dataset.source}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3">
                            <Badge tone={availability.tone}>
                              {availability.label}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3">
                            <Badge
                              tone={
                                dataset.localFileVerified
                                  ? "success"
                                  : "outline"
                              }
                            >
                              {dataset.localFileVerified
                                ? "Verified"
                                : "Not verified"}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">
                            {formatCount(dataset.participantCount)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-muted">
                            {formatCount(dataset.sampleCount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <CardFooter>
          <p className="text-xs text-ink-subtle">
            “Not documented” means the synthetic fixture does not provide a
            count. No value is estimated.
          </p>
          <Link
            href="/research/explainability"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-600"
          >
            Explainability
          </Link>
        </CardFooter>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Data integrity policy</CardTitle>
            <CardDescription>
              Rules applied to dataset metadata in this frontend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResearchDetailRow
              label="Local file verification"
              value="Not performed"
              detail="No checksum, file listing, or dataset inspection occurs."
            />
            <ResearchDetailRow
              label="Participant counts"
              value="Fixture only"
              detail="Counts are shown only when explicitly provided; otherwise marked not documented."
            />
            <ResearchDetailRow
              label="Sample counts"
              value="Fixture only"
              detail="No signal samples are counted or generated."
            />
            <ResearchDetailRow
              label="Session-only data"
              value="Browser session"
              detail="Session-only metadata is not persisted or exported by this page."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unavailable dataset controls</CardTitle>
            <CardDescription>
              Operations that are not implemented.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResearchAvailabilityRow
              label="Upload or import dataset"
              status="Unavailable"
              tone="outline"
              description="No dataset ingestion endpoint or local file picker is connected."
            />
            <ResearchAvailabilityRow
              label="Download dataset"
              status="Unavailable"
              tone="outline"
              description="No dataset file or export endpoint exists."
            />
            <ResearchAvailabilityRow
              label="Inspect or validate files"
              status="Unavailable"
              tone="outline"
              description="No file system access, parser, or validation pipeline exists."
            />
            <ResearchAvailabilityRow
              label="Delete dataset metadata"
              status="Read-only fixture"
              tone="outline"
              description="Dataset metadata is static and cannot be edited."
            />
          </CardContent>
        </Card>
      </div>

      {filteredDatasets.length > 0 ? (
        <section
          aria-labelledby="dataset-details-heading"
          className="space-y-3"
        >
          <div>
            <h2
              id="dataset-details-heading"
              className="text-sm font-semibold text-ink"
            >
              Dataset details and limitations
            </h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Intended use, formats, provenance, and documented constraints.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {filteredDatasets.map((dataset) => {
              const availability =
                researchDatasetAvailabilityConfig[dataset.availability];

              return (
                <Card key={dataset.id} className="flex flex-col">
                  <CardHeader className="flex-row items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle>{dataset.name}</CardTitle>
                      <CardDescription>
                        {dataset.id} · {dataset.modality}
                      </CardDescription>
                    </div>
                    <Badge tone={availability.tone}>
                      {availability.label}
                    </Badge>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-4">
                    <p className="text-sm leading-6 text-ink-muted">
                      {dataset.description}
                    </p>

                    <div>
                      <ResearchDetailRow
                        label="Intended use"
                        value={dataset.intendedUse}
                      />
                      <ResearchDetailRow
                        label="Formats"
                        value={
                          dataset.formats.length > 0
                            ? dataset.formats.join(", ")
                            : "Not documented"
                        }
                      />
                      <ResearchDetailRow
                        label="Source"
                        value={dataset.source}
                      />
                      <ResearchDetailRow
                        label="Local file"
                        value={
                          dataset.localFileVerified
                            ? "Verified"
                            : "Not verified"
                        }
                        detail="No local dataset file is present or checked."
                      />
                    </div>

                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
                        <ShieldAlert
                          aria-hidden="true"
                          className="size-3.5 text-demo"
                        />
                        Limitations
                      </p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-ink-subtle">
                        {dataset.limitations.map((limitation) => (
                          <li key={limitation}>{limitation}</li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>

                  <CardFooter>
                    <p className="text-xs leading-5 text-ink-subtle">
                      {dataset.provenance}
                    </p>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      <Alert tone="info" title="No dataset claims">
        Dataset metadata does not imply ethics approval, consent, clinical
        suitability, completeness, or fitness for model training. Those claims
        require separate evidence that is not present in this demo.
      </Alert>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/research/experiments" variant="outline">
          <FileWarning aria-hidden="true" className="size-4" />
          Experiment inventory
        </ButtonLink>
        <ButtonLink href="/research/models" variant="outline">
          Model comparison
        </ButtonLink>
      </div>
    </div>
  );
}
