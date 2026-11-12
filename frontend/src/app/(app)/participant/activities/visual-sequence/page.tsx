import type { Metadata } from "next";
import { VisualSequenceActivity } from "@/features/activities/visual-sequence/visual-sequence-activity";

export const metadata: Metadata = {
  title: "Visual Sequence Memory",
  description:
    "Interactive Visual Sequence Memory task: watch squares light up and tap them back in order, with practice and scored trials.",
};

export default function VisualSequencePage() {
  return <VisualSequenceActivity />;
}
