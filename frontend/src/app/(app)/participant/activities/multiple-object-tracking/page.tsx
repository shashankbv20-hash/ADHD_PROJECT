import type { Metadata } from "next";
import { ObjectTrackingActivity } from "@/features/activities/object-tracking/object-tracking-activity";

export const metadata: Metadata = {
  title: "Multiple Object Tracking",
  description:
    "Interactive Multiple Object Tracking task: follow a few marked circles as they move among identical ones.",
};

export default function ObjectTrackingPage() {
  return <ObjectTrackingActivity />;
}
