import type { ProcessingStageId } from "@/types";

export interface ProcessingStageDefinition {
  id: ProcessingStageId;
  label: string;
  description: string;
  simulated: boolean;
}

export const processingStages: ProcessingStageDefinition[] = [
  {
    id: "received",
    label: "Demo session created",
    description:
      "A local demo record was created from the file metadata. No file contents were read.",
    simulated: false,
  },
  {
    id: "validated",
    label: "Client-side file checks",
    description:
      "File extension, size, and consent acknowledgement passed in your browser.",
    simulated: false,
  },
  {
    id: "preprocessing",
    label: "Demo preprocessing",
    description:
      "Simulated stage. No filtering, referencing, or artifact rejection is performed.",
    simulated: true,
  },
  {
    id: "features",
    label: "Demo feature summary",
    description:
      "Simulated stage. No spectral, connectivity, or behavioral features are extracted.",
    simulated: true,
  },
  {
    id: "review",
    label: "Review handoff",
    description:
      "Marks the demo walkthrough complete and opens a session record containing metadata only.",
    simulated: true,
  },
];
