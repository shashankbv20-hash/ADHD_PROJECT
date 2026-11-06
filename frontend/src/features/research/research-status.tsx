import type { BadgeTone } from "@/components/ui/badge";
import type {
  ModelStatus,
  ResearchDatasetAvailability,
  ResearchExecutionStatus,
  ResearchExperimentStatus,
} from "@/types";

export const researchModelStatusConfig: Record<
  ModelStatus,
  { label: string; tone: BadgeTone; description: string }
> = {
  evaluated: {
    label: "Illustrative metrics",
    tone: "warning",
    description:
      "Metric values exist only in the synthetic fixture; no evaluation run occurred.",
  },
  "in-review": {
    label: "In review",
    tone: "warning",
    description: "No evaluation metrics are available for this entry.",
  },
  planned: {
    label: "Planned",
    tone: "neutral",
    description: "Model metadata is planned; no configuration or metrics exist.",
  },
  unavailable: {
    label: "Unavailable",
    tone: "outline",
    description: "Model metadata is unavailable.",
  },
};

export const researchExperimentStatusConfig: Record<
  ResearchExperimentStatus,
  { label: string; tone: BadgeTone }
> = {
  planned: { label: "Planned", tone: "neutral" },
  "in-progress": { label: "In progress", tone: "brand" },
  completed: { label: "Completed", tone: "success" },
  unavailable: { label: "Unavailable", tone: "outline" },
};

export const researchExecutionStatusConfig: Record<
  ResearchExecutionStatus,
  { label: string; description: string }
> = {
  "not-run": {
    label: "Not run",
    description: "No experiment execution record exists in this frontend.",
  },
  "demo-only": {
    label: "Demo only",
    description: "Only synthetic demonstration metadata is available.",
  },
};

export const researchExplainabilityStatusConfig: Record<
  "illustrative" | "unavailable",
  { label: string; tone: BadgeTone; description: string }
> = {
  illustrative: {
    label: "Illustrative only",
    tone: "warning",
    description:
      "Attribution values are synthetic placeholders and are not computed explanations.",
  },
  unavailable: {
    label: "Unavailable",
    tone: "outline",
    description: "No explanation outputs are available.",
  },
};

export const researchDatasetAvailabilityConfig: Record<
  ResearchDatasetAvailability,
  { label: string; tone: BadgeTone; description: string }
> = {
  "demo-fixture": {
    label: "Demo fixture",
    tone: "warning",
    description: "Synthetic metadata label; no verified local dataset file.",
  },
  "session-only": {
    label: "Session only",
    tone: "brand",
    description: "Available only in the current browser session.",
  },
  "demo-metadata": {
    label: "Metadata only",
    tone: "warning",
    description: "Demonstration metadata without signal or file contents.",
  },
  unavailable: {
    label: "Unavailable",
    tone: "outline",
    description: "No dataset metadata or source is available.",
  },
};
