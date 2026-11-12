import type { Metadata } from "next";
import { TimePerceptionActivity } from "@/features/activities/time-perception/time-perception-activity";

export const metadata: Metadata = {
  title: "Time Perception",
  description:
    "Interactive Time Perception task: watch a circle for a few seconds, then reproduce how long it was shown.",
};

export default function TimePerceptionPage() {
  return <TimePerceptionActivity />;
}
