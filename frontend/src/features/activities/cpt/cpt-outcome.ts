import type { BadgeTone } from "@/components/ui/badge";
import type { CptTrialOutcome } from "@/types";

export interface CptOutcomeDefinition {
  label: string;
  description: string;
  tone: BadgeTone;
}

export const cptOutcomeConfig: Record<
  CptTrialOutcome,
  CptOutcomeDefinition
> = {
  hit: {
    label: "Correct detection",
    description: "You responded when the target letter X appeared.",
    tone: "success",
  },
  miss: {
    label: "Missed target",
    description: "The target letter X appeared and no response was recorded.",
    tone: "warning",
  },
  "false-alarm": {
    label: "False alarm",
    description: "A response was recorded for a letter that was not the target.",
    tone: "danger",
  },
  "correct-rejection": {
    label: "Correct rejection",
    description: "You correctly withheld a response for a non-target letter.",
    tone: "neutral",
  },
};
