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
      "Respond quickly to frequent go cues (green circle) while holding back on occasional no-go cues (red circle). Includes a short practice before 32 scored trials.",
    estimatedDurationMinutes: 3,
    availability: "available",
    href: "/participant/activities/go-no-go",
  },
  {
    id: "stop-signal",
    title: "Stop-Signal",
    description:
      "Press the arrow key that matches the arrow. On some trials a red STOP border appears: try to hold back. The delay adapts to how you are doing. Includes a short practice before 32 scored trials.",
    estimatedDurationMinutes: 4,
    availability: "available",
    href: "/participant/activities/stop-signal",
  },
  {
    id: "stroop",
    title: "Stroop",
    description:
      "A colour word appears in an ink colour. Choose the ink colour, not the word. Sometimes they agree and sometimes they conflict. Includes a short practice before 32 scored trials.",
    estimatedDurationMinutes: 4,
    availability: "available",
    href: "/participant/activities/stroop",
  },
  {
    id: "task-switching",
    title: "Task Switching",
    description:
      "A coloured shape appears with a rule: sort it by colour or by shape. The rule changes now and then. Includes a short practice before 32 scored trials.",
    estimatedDurationMinutes: 4,
    availability: "available",
    href: "/participant/activities/task-switching",
  },
  {
    id: "visual-search",
    title: "Visual Search",
    description:
      "Look for a red T hidden among blue Ts and red Ls and say whether it is there. The screen gets busier as you go. Includes a short practice before 30 scored screens.",
    estimatedDurationMinutes: 4,
    availability: "available",
    href: "/participant/activities/visual-search",
  },
  {
    id: "planning-puzzle",
    title: "Planning Puzzle",
    description:
      "Move a stack of discs from the first peg to the goal peg, one at a time, never putting a larger disc on a smaller one. Includes a practice puzzle before 3 scored puzzles.",
    estimatedDurationMinutes: 6,
    availability: "available",
    href: "/participant/activities/planning-puzzle",
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
      "Press when the letter matches the one shown 1 step earlier, then 2 steps earlier. Includes a short practice before 32 scored trials.",
    estimatedDurationMinutes: 4,
    availability: "available",
    href: "/participant/activities/n-back",
  },
  {
    id: "visual-sequence",
    title: "Visual Sequence Memory",
    description:
      "Watch squares light up on a small grid, then tap them back in the same order. Sequences grow from 3 to 6 squares. Includes a short practice before 8 scored sequences.",
    estimatedDurationMinutes: 4,
    availability: "available",
    href: "/participant/activities/visual-sequence",
  },
  {
    id: "time-perception",
    title: "Time Perception",
    description:
      "Watch a circle for a few seconds, then press Start and Stop to show how long it was on the screen. Includes a short practice before 8 scored trials.",
    estimatedDurationMinutes: 3,
    availability: "available",
    href: "/participant/activities/time-perception",
  },
  {
    id: "multiple-object-tracking",
    title: "Multiple Object Tracking",
    description:
      "A few circles are marked, then all the circles move around looking the same. Keep following the marked ones and pick them when the circles stop. Includes a short practice before 6 scored trials.",
    estimatedDurationMinutes: 5,
    availability: "available",
    href: "/participant/activities/multiple-object-tracking",
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
