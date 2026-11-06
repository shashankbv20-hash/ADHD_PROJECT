import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/register-form";

export const metadata: Metadata = {
  title: "Create a participant account",
  description:
    "Create a participant account for the Attune ADHD EEG research workspace. Public registration does not grant clinician or researcher access.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
