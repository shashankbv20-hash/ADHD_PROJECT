import type { Metadata } from "next";
import { StroopActivity } from "@/features/activities/stroop/stroop-activity";

export const metadata: Metadata = {
  title: "Stroop",
  description:
    "Interactive Stroop task: choose the ink colour of a colour word, with practice and scored trials.",
};

export default function StroopPage() {
  return <StroopActivity />;
}
