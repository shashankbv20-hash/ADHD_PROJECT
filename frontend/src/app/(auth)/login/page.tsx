import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to the Attune research workspace with an authorized participant, clinician, or researcher account, or explore an isolated demo portal.",
};

export default function LoginPage() {
  return <LoginForm />;
}
