import type { Metadata } from "next";
import { StopSignalActivity } from "@/features/activities/stop-signal/stop-signal-activity";

export const metadata: Metadata = {
  title: "Stop-Signal",
  description:
    "Interactive Stop-Signal task with practice and scored trials, an adaptive stop-signal delay and SSRT.",
};

export default function StopSignalPage() {
  return <StopSignalActivity />;
}
