import type { Metadata } from "next";
import { VisualSearchActivity } from "@/features/activities/visual-search/visual-search-activity";

export const metadata: Metadata = {
  title: "Visual Search",
  description:
    "Interactive Visual Search task: decide whether a red T is hidden among other letters, with practice and scored trials.",
};

export default function VisualSearchPage() {
  return <VisualSearchActivity />;
}
