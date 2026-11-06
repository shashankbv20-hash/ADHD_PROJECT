import type { Metadata } from "next";
import { CptActivity } from "@/features/activities/cpt/cpt-activity";

export const metadata: Metadata = {
  title: "Continuous Performance Task",
  description:
    "Interactive demo Continuous Performance Task with practice, scored trials, and an in-memory summary.",
};

export default function CptPage() {
  return <CptActivity />;
}
