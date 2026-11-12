import type { Metadata } from "next";
import { PlanningPuzzleActivity } from "@/features/activities/planning-puzzle/planning-puzzle-activity";

export const metadata: Metadata = {
  title: "Planning Puzzle",
  description:
    "Interactive Planning Puzzle (Tower of Hanoi): plan moves to transfer a stack of discs, with practice and scored puzzles.",
};

export default function PlanningPuzzlePage() {
  return <PlanningPuzzleActivity />;
}
