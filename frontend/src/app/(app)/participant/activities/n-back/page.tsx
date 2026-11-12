import type { Metadata } from "next";
import { NBackActivity } from "@/features/activities/n-back/n-back-activity";

export const metadata: Metadata = {
  title: "N-back",
  description:
    "Interactive N-back working-memory task: 1-back then 2-back, with practice and scored trials.",
};

export default function NBackPage() {
  return <NBackActivity />;
}
