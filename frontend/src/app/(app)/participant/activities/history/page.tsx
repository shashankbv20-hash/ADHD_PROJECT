import type { Metadata } from "next";
import { ActivityHistory } from "@/features/activities/activity-history";

export const metadata: Metadata = {
  title: "Activity history",
  description:
    "In-memory history of completed Continuous Performance Task runs with links to calculated metrics and trial events.",
};

export default function ActivityHistoryPage() {
  return <ActivityHistory />;
}
