import type { CognitiveActivityDefinition } from "@/types";

export const demoCognitiveActivities: CognitiveActivityDefinition[] = [
  {
    id: "cpt",
    title: "Continuous Performance Task",
    description:
      "Watch a stream of letters and respond only when the target letter X appears. Includes a short practice run before 24 scored trials.",
    estimatedDurationMinutes: 3,
    availability: "available",
    href: "/participant/activities/cpt",
  },
  {
    id: "go-no-go",
    title: "Go / No-Go",
    description:
      "Respond quickly to frequent go cues while withholding a response to occasional no-go cues.",
    estimatedDurationMinutes: 4,
    availability: "planned",
  },
  {
    id: "selective-attention",
    title: "Selective Attention",
    description:
      "Find target shapes among distractors while the visual field becomes progressively busier.",
    estimatedDurationMinutes: 5,
    availability: "planned",
  },
  {
    id: "n-back",
    title: "N-back",
    description:
      "Track a changing sequence and decide whether the current item matches the one shown n steps earlier.",
    estimatedDurationMinutes: 5,
    availability: "planned",
  },
  {
    id: "visual-sequence",
    title: "Visual Sequence Memory",
    description:
      "Remember and reproduce a sequence of highlighted positions across a small grid.",
    estimatedDurationMinutes: 4,
    availability: "planned",
  },
  {
    id: "focus-arena",
    title: "Focus Arena",
    description:
      "A playful sustained-attention game designed to make practice feel lighter and more approachable.",
    estimatedDurationMinutes: 6,
    availability: "planned",
  },
];
