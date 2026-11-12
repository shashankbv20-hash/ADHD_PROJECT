import type { Metadata } from "next";
import { GoNoGoActivity } from "@/features/activities/go-no-go/go-no-go-activity";

export const metadata: Metadata = {
  title: "Go / No-Go",
  description:
    "Interactive Go/No-Go response-inhibition task with practice and scored trials.",
};

export default function GoNoGoPage() {
  return <GoNoGoActivity />;
}
