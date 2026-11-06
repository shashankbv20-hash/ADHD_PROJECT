import type { Metadata } from "next";
import { CptProgressView } from "@/features/activities/cpt/cpt-progress-view";

export const metadata: Metadata = {
  title: "Progress",
  description:
    "In-memory CPT progress with aggregate descriptive metrics and multi-run accuracy and reaction-time trends.",
};

export default function ProgressPage() {
  return <CptProgressView />;
}
