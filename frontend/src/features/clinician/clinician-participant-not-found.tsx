import { ArrowLeft, SearchX } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function ClinicianParticipantNotFound({
  participantId,
}: {
  participantId: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinician workspace"
        title="Participant not found"
        description="No synthetic clinician participant record matches this identifier."
        meta={
          <span className="font-mono text-xs text-ink-subtle">
            Requested ID: {participantId}
          </span>
        }
        actions={
          <ButtonLink href="/clinician/participants" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Participant roster
          </ButtonLink>
        }
      />

      <Alert tone="warning" title="Unknown participant identifier">
        This identifier is not present in the synthetic demonstration roster. No
        participant, session, activity, EEG, or Digital Twin data is inferred.
      </Alert>

      <Card>
        <CardContent className="py-6">
          <EmptyState
            icon={SearchX}
            title="No matching demonstration record"
            description="Return to the participant roster to choose an available synthetic participant."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href="/clinician/participants">
                  Back to participant roster
                </ButtonLink>
                <ButtonLink href="/clinician" variant="outline">
                  Clinician overview
                </ButtonLink>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
