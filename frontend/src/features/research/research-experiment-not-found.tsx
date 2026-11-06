import { ArrowLeft, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function ResearchExperimentNotFound({
  experimentId,
}: {
  experimentId: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research workspace"
        title="Experiment not found"
        description="The requested synthetic experiment record does not exist in the local research fixture."
        actions={
          <ButtonLink href="/research/experiments" variant="outline">
            <ArrowLeft aria-hidden="true" className="size-4" />
            All experiments
          </ButtonLink>
        }
      />

      <Card>
        <CardContent className="py-6">
          <EmptyState
            icon={ClipboardList}
            title="No experiment with that identifier"
            description={`No synthetic experiment record matches "${experimentId}". No experiment or result data is inferred.`}
            action={
              <ButtonLink href="/research/experiments">
                Back to experiment inventory
              </ButtonLink>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
