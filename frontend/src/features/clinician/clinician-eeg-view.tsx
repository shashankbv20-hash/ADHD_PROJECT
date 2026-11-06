import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CircleSlash2,
  Database,
  Waves,
} from "lucide-react";
import { BandPowerChart } from "@/components/charts/band-power-chart";
import { EegWaveform } from "@/components/charts/eeg-waveform";
import { DemoNotice } from "@/components/feedback/demo-notice";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { illustrativeEegFixture } from "@/data/demo/eeg-illustration";
import { ClinicianAvailabilityRow } from "@/features/clinician/clinician-rows";
import { ClinicianMetricCard } from "@/features/clinician/clinician-metric-card";
import { ClinicianParticipantNav } from "@/features/clinician/clinician-participant-nav";
import { formatDate } from "@/lib/utils";
import type { ClinicianParticipant, DemoMeta } from "@/types";

export function ClinicianEegView({
  participant,
  meta,
}: {
  participant: ClinicianParticipant;
  meta: DemoMeta;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinician workspace"
        title="EEG analysis"
        description={`Review EEG recording availability for ${participant.displayName} (${participant.researchCode}). This prototype has no linked EEG signal, recording metadata, preprocessing output, or model inference for any participant.`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning" dot>
              Synthetic participant
            </Badge>
            <span className="font-mono text-xs text-ink-subtle">
              {participant.researchCode} · {participant.ageBand}
            </span>
            <span className="text-xs text-ink-subtle">
              No EEG recording linked
            </span>
          </div>
        }
        actions={
          <>
            <ButtonLink
              href={`/clinician/participants/${participant.id}`}
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Participant overview
            </ButtonLink>
            <ButtonLink
              href={`/clinician/participants/${participant.id}/behavior`}
              variant="outline"
            >
              Behavioral summary
              <ArrowRight aria-hidden="true" className="size-4" />
            </ButtonLink>
          </>
        }
      />

      <DemoNotice meta={meta} />

      <ClinicianParticipantNav participantId={participant.id} />

      <Alert tone="warning" title="No EEG recording is linked">
        The clinician data model does not associate EEG recording IDs with
        participant records. No sampling rate, channel count, duration, quality
        score, frequency-band value, or model probability is inferred. The
        preview below is illustrative interface content only.
      </Alert>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClinicianMetricCard
          icon={Waves}
          label="Linked EEG recordings"
          value="0"
          detail="No recording identifier is associated with this participant."
        />
        <ClinicianMetricCard
          icon={Database}
          label="Session-level EEG"
          value="Not linked"
          detail="Roster session summaries do not contain EEG signal references."
        />
        <ClinicianMetricCard
          icon={Activity}
          label="EEG-derived features"
          value="Not connected"
          detail="No preprocessing or feature-extraction service exists."
        />
        <ClinicianMetricCard
          icon={CircleSlash2}
          label="Model outputs"
          value="Not available"
          detail="No trained model or inference result exists."
        />
      </dl>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Recording availability</CardTitle>
              <CardDescription>
                Explicit source states for the current prototype.
              </CardDescription>
            </div>
            <Badge tone="outline">Not connected</Badge>
          </CardHeader>
          <CardContent>
            <ClinicianAvailabilityRow
              label="Raw EEG signal"
              status="Unavailable"
              tone="outline"
              description="No EEG file, stream, or recording identifier is stored for this participant."
            />
            <ClinicianAvailabilityRow
              label="Recording metadata"
              status="Unavailable"
              tone="outline"
              description="Sampling rate, channel count, duration, device, and acquisition date are not recorded."
            />
            <ClinicianAvailabilityRow
              label="Signal quality assessment"
              status="Unavailable"
              tone="outline"
              description="The roster signal-quality field is a synthetic summary and is not an EEG quality measurement."
            />
            <ClinicianAvailabilityRow
              label="Frequency-band analysis"
              status="Not connected"
              tone="outline"
              description="No spectral analysis or relative band-power calculation has been performed."
            />
            <ClinicianAvailabilityRow
              label="Artifact and preprocessing results"
              status="Not connected"
              tone="outline"
              description="No filtering, artifact rejection, segmentation, or preprocessing pipeline exists."
            />
            <ClinicianAvailabilityRow
              label="Model inference"
              status="Not available"
              tone="outline"
              description="No trained EEG model, prediction, or confidence value is available."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roster context</CardTitle>
            <CardDescription>
              Synthetic summary fields, not recording measurements.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                  Roster sessions
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold text-ink">
                  {participant.sessionCount}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
                  Last session
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-ink">
                  {formatDate(participant.lastSessionAt)}
                </dd>
              </div>
            </dl>

            <div className="rounded-lg border border-dashed border-line-strong bg-slate-50/60 p-3">
              <p className="text-xs leading-5 text-ink-muted">
                These values come from the synthetic clinician roster. They do
                not identify an EEG recording and cannot be used to reconstruct
                a session timeline.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="eeg-preview-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="eeg-preview-heading"
              className="text-sm font-semibold text-ink"
            >
              Illustrative visualization preview
            </h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Separate synthetic content used to demonstrate the interface. It
              is not associated with this participant.
            </p>
          </div>
          <Badge tone="warning">Synthetic fixture</Badge>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Waveform preview</CardTitle>
              <CardDescription>
                Static synthetic signal generated for layout demonstration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <EegWaveform
                className="h-[240px]"
                label={illustrativeEegFixture.waveformLabel}
              />
              <p className="text-xs leading-5 text-ink-subtle">
                No axes, time scale, amplitude scale, or channel labels are
                shown because no real recording metadata exists.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Band-power preview</CardTitle>
                <CardDescription>
                  Illustrative relative values, not participant measurements.
                </CardDescription>
              </div>
              <Badge tone="outline">Demo</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <BandPowerChart data={illustrativeEegFixture.bandPower} />
              <p className="text-xs leading-5 text-ink-subtle">
                {illustrativeEegFixture.note}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>EEG analysis status</CardTitle>
          <CardDescription>
            What would be required before clinician EEG review is available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-6 text-ink-muted">
            A real implementation would need an authorized recording source,
            participant-to-recording linkage, acquisition metadata, a validated
            preprocessing pipeline, quality review, and a versioned analysis
            workflow. None of those services are part of this frontend
            prototype.
          </p>
          <p className="text-sm leading-6 text-ink-muted">
            The illustrative preview must not be interpreted as a clinical
            finding, diagnostic result, or evidence about this participant.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
