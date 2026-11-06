import type { Metadata } from "next";
import { DigitalTwinProfileView } from "@/features/digital-twin/digital-twin-profile-view";
import { FirebaseDigitalTwinProfile } from "@/features/firebase/firebase-digital-twin-profile";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { getDemoRole } from "@/lib/demo/demo-session-server";

export const metadata: Metadata = {
  title: "Digital Twin",
  description:
    "Research Digital Twin profile built from in-memory CPT measurements, with explicit modality and data-quality states.",
};

export default async function DigitalTwinPage() {
  const config = getFrontendConfig();
  const demoRole = await getDemoRole();

  if (config.valid && config.provider === "firebase" && !demoRole) {
    return <FirebaseDigitalTwinProfile />;
  }

  return <DigitalTwinProfileView />;
}
