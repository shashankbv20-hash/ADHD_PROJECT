import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsView } from "@/features/settings/settings-view";

export const metadata: Metadata = {
  title: "Settings",
  description: "Your profile and practice reminders.",
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Participant workspace"
        title="Settings"
        description="Your profile and practice reminders. Data and privacy controls are on their own page."
      />
      <SettingsView />
    </div>
  );
}
