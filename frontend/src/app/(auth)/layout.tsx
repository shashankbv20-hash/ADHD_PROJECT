import {
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
} from "lucide-react";
import Link from "next/link";
import { EegWaveform } from "@/components/charts/eeg-waveform";
import { Logo } from "@/components/layout/logo";
import { getFrontendConfig } from "@/lib/config/frontend-config";

const highlights = [
  "One session context across participant, clinician, and research views.",
  "Explicit demo labels, empty states, and service limitations.",
  "A typed interface ready for future backend contracts.",
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = getFrontendConfig();
  const isFirebase = config.valid && config.provider === "firebase";
  const authHighlights = isFirebase
    ? [
        "Firebase Authentication manages account credentials.",
        "Verified custom claims determine participant, clinician, or research access.",
        "Participant records are scoped to the signed-in UID; staff data is not simulated.",
      ]
    : highlights;

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="relative hidden overflow-hidden bg-ink lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <div aria-hidden="true" className="absolute inset-0 bg-grid opacity-50" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(32,162,150,0.24),transparent_55%)]"
        />

        <div className="relative">
          <Logo onDark />
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-demo-line/30 bg-demo/10 px-2.5 py-0.5 text-xs font-medium text-demo">
            <FlaskConical aria-hidden="true" className="size-3.5" />
            Research prototype
          </span>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white xl:text-4xl">
            A shared research language for attention.
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/55">
            Attune is being designed as a research and support workspace for
            EEG sessions, cognitive activities, and digital twin profiles. It
            is not a diagnostic or treatment device.
          </p>
          <ul className="mt-7 space-y-4">
            {authHighlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2.5">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-brand-300"
                />
                <span className="text-sm leading-6 text-white/60">
                  {highlight}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative space-y-4">
          <EegWaveform className="h-28" showCaption={false} />
          <p className="text-xs leading-5 text-white/35">
            {isFirebase
              ? "Firebase handles authentication credentials. No EEG recording or clinical data is uploaded by sign-in."
              : "Demonstration authentication interface. No real credentials are processed or stored, and no account is created."}
          </p>
        </div>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col">
        <div className="flex items-center justify-between gap-4 px-6 py-5 lg:justify-end lg:px-10">
          <div className="lg:hidden">
            <Logo />
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-10 lg:px-10">
          <div className="w-full max-w-xl">{children}</div>
        </div>

        <div className="px-6 pb-8 lg:px-10">
          <p className="text-center text-xs leading-5 text-ink-subtle">
            {isFirebase
              ? "Attune research prototype · Role-verified access · Not a medical device"
              : "Attune research prototype · Not a medical device · Synthetic demo data only"}
          </p>
        </div>
      </main>
    </div>
  );
}
