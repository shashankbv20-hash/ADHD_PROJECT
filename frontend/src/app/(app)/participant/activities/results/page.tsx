import type { Metadata } from "next";
import { ActivityResultsView } from "@/features/activities/activity-results-view";

export const metadata: Metadata = {
  title: "Results by activity",
  description: "Previous scored session results for each cognitive activity, listed separately.",
};

export default function ActivityResultsPage() {
  return <ActivityResultsView />;
}
