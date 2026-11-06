import {
  ArrowRight,
  BrainCircuit,
  Check,
  ClipboardList,
  Fingerprint,
  FlaskConical,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  UploadCloud,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { EegWaveform } from "@/components/charts/eeg-waveform";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const workspaceCards = [
  {
    icon: UserRound,
    title: "Participant & caregiver",
    description:
      "A calm, understandable view of sessions, cognitive activities, and progress — with clear labels whenever content is demonstration data.",
    features: [
      "Session history and progress",
      "EEG upload and validation",
      "Research Digital Twin profile",
    ],
    href: "/participant",
    cta: "Open participant demo",
  },
  {
    icon: Stethoscope,
    title: "Clinician",
    description:
      "A structured review workspace for participant rosters, session context, comparisons, and research reports.",
    features: [
      "Participant roster and search",
      "Signal and activity summaries",
      "Session comparison and reports",
    ],
    href: "/clinician",
    cta: "Open clinician demo",
  },
  {
    icon: FlaskConical,
    title: "Research & administration",
    description:
      "A transparent view of experiments, datasets, model evaluations, and explainability — with provenance attached to results.",
    features: [
      "Dataset and experiment inventory",
      "Model comparison interface",
      "Explainability visualizations",
    ],
    href: "/research",
    cta: "Open research demo",
  },
];

const workflowSteps = [
  {
    icon: UploadCloud,
    step: "01",
    title: "Capture or upload",
    description:
      "Participants or caregivers start with a supported EEG recording and a clear description of the session protocol.",
  },
  {
    icon: ScanLine,
    step: "02",
    title: "Validate",
    description:
      "The interface exposes file checks, signal quality, and artifact flags before anything is sent for analysis.",
  },
  {
    icon: ClipboardList,
    step: "03",
    title: "Review analysis",
    description:
      "Results are presented with their source, processing status, and limitations — never as unexplained outputs.",
  },
  {
    icon: Users,
    step: "04",
    title: "Share context",
    description:
      "Role-appropriate views help participants, clinicians, and researchers work from the same session context.",
  },
];

const principles = [
  {
    icon: ShieldCheck,
    title: "Demo data is always labelled",
    description:
      "Synthetic fixtures are separated from UI code and visibly marked in every workspace.",
  },
  {
    icon: LockKeyhole,
    title: "No sensitive data in the browser",
    description:
      "This prototype does not store credentials, EEG files, or participant records in browser storage.",
  },
  {
    icon: BrainCircuit,
    title: "States are designed, not improvised",
    description:
      "Loading, empty, validation, service failure, and unavailable states are treated as first-class UI.",
  },
  {
    icon: Fingerprint,
    title: "Provenance stays visible",
    description:
      "Every analysis or model view has room for its source, status, and validation context.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto max-w-2xl text-center"
          : "max-w-2xl text-left"
      }
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-ink-muted sm:text-base">
        {description}
      </p>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div
        aria-hidden="true"
        className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-brand-100/70 blur-2xl"
      />

      <div className="absolute -right-3 -top-5 z-10 hidden w-44 rounded-xl border border-line bg-surface p-3.5 shadow-raised sm:block">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Focus index
          </p>
          <span className="rounded-full border border-demo-line bg-demo-soft px-1.5 py-0 text-[9px] font-medium text-demo">
            Demo
          </span>
        </div>
        <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight text-ink">
          68
          <span className="text-sm text-ink-subtle">/100</span>
        </p>
        <svg
          viewBox="0 0 120 36"
          aria-hidden="true"
          className="mt-1 h-9 w-full"
        >
          <path
            d="M0 28 12 24 24 26 36 18 48 20 60 14 72 17 84 11 96 13 108 7 120 9"
            fill="none"
            stroke="#12857c"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="mt-1 text-[10px] text-ink-subtle">8-session trend</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink p-4 shadow-raised sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-white/20" />
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/10" />
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-white/50">
            Synthetic interface preview
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] text-white/45">Session S-2410</p>
            <p className="mt-1 text-base font-medium text-white">
              Continuous performance task
            </p>
          </div>
          <span className="font-mono text-[11px] text-brand-300">22 min</span>
        </div>

        <EegWaveform className="mt-4 h-44" />

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: "Signal quality", value: "96%" },
            { label: "Focus index", value: "71/100" },
            { label: "Artifacts", value: "2 flagged" },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2"
            >
              <p className="text-[9px] uppercase tracking-[0.1em] text-white/35">
                {metric.label}
              </p>
              <p className="mt-1 font-mono text-xs font-medium text-white/85">
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[10px] leading-4 text-white/35">
          Illustrative interface content. Not a real EEG recording or clinical
          result.
        </p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(32,162,150,0.14),transparent_55%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-dot-grid opacity-40 lg:block"
          />

          <div className="relative mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand" dot>
                  Research prototype
                </Badge>
                <Badge tone="warning">Demonstration data only</Badge>
              </div>

              <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-[3.35rem] lg:leading-[1.05]">
                A clearer view of attention,{" "}
                <span className="text-brand-700">built on better context.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">
                Attune brings EEG sessions, cognitive activities, and digital
                twin profiles into one research workspace — designed for
                participants, clinicians, and researchers to work from the same
                evidence.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/participant" size="lg">
                  Explore the participant demo
                  <ArrowRight aria-hidden="true" className="size-4" />
                </ButtonLink>
                <ButtonLink href="/register" variant="outline" size="lg">
                  Create a demo account
                </ButtonLink>
              </div>

              <p className="mt-4 flex items-center gap-2 text-xs leading-5 text-ink-subtle">
                <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
                No diagnostic claims. No real EEG data. Interface prototype
                only.
              </p>
            </div>

            <HeroPreview />
          </div>
        </section>

        <section
          id="platform"
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
        >
          <SectionHeading
            eyebrow="One research thread"
            title="Three perspectives, one shared session context"
            description="Each workspace is designed around the decisions its users need to make — while keeping the underlying session and its provenance consistent."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {workspaceCards.map((workspace) => {
              const Icon = workspace.icon;

              return (
                <Card
                  key={workspace.title}
                  className="flex flex-col p-5 transition-shadow hover:shadow-raised"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-ink">
                    {workspace.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">
                    {workspace.description}
                  </p>
                  <ul className="mt-4 space-y-2 border-t border-line/80 pt-4">
                    {workspace.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-ink-muted"
                      >
                        <Check
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0 text-brand-600"
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={workspace.href}
                    className="mt-5 inline-flex items-center gap-1.5 rounded text-sm font-medium text-brand-800 transition-colors hover:text-brand-600"
                  >
                    {workspace.cta}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </Card>
              );
            })}
          </div>
        </section>

        <section
          id="workflow"
          className="border-y border-line bg-surface/70"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <SectionHeading
              eyebrow="Workflow"
              title="From recording to review, in a traceable sequence"
              description="The participant journey comes first. Advanced clinical and research views build on the same underlying session model."
            />

            <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {workflowSteps.map((step, index) => {
                const Icon = step.icon;

                return (
                  <div
                    key={step.step}
                    className="relative rounded-xl border border-line bg-surface p-5 shadow-card"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-ink text-white">
                        <Icon aria-hidden="true" className="size-[18px]" />
                      </span>
                      <span className="font-mono text-xs font-medium text-ink-subtle">
                        {step.step}
                      </span>
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-ink-muted">
                      {step.description}
                    </p>
                    {index < workflowSteps.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="absolute -right-2 top-1/2 hidden size-4 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink-subtle xl:flex"
                      >
                        <ArrowRight className="size-2.5" />
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <p className="mt-5 text-xs leading-5 text-ink-subtle">
              Upload, preprocessing, analysis, and model inference are not
              connected in this frontend prototype. Workflow screens are
              illustrative.
            </p>
          </div>
        </section>

        <section
          id="research-transparency"
          className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
        >
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <Badge tone="accent">Responsible by design</Badge>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Research clarity is a design requirement
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-ink-muted sm:text-base">
                This platform is being built for research and support, not
                diagnosis or treatment. The interface is designed to make data
                provenance, limitations, and service availability explicit
                rather than implied.
              </p>

              <div className="mt-6 rounded-xl border border-demo-line bg-demo-soft p-5">
                <p className="text-sm font-semibold text-demo">
                  What this prototype does not do
                </p>
                <ul className="mt-2 space-y-1.5 text-sm leading-6 text-ink-muted">
                  <li>It does not process or analyze real EEG recordings.</li>
                  <li>It does not provide authentication or persistent accounts.</li>
                  <li>It does not store participant data or credentials.</li>
                  <li>It does not present validated model or clinical results.</li>
                </ul>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {principles.map((principle) => {
                const Icon = principle.icon;

                return (
                  <Card key={principle.title} className="p-5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <Icon aria-hidden="true" className="size-[18px]" />
                    </span>
                    <h3 className="mt-3 text-sm font-semibold text-ink">
                      {principle.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-ink-muted">
                      {principle.description}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-ink">
          <div aria-hidden="true" className="absolute inset-0 bg-grid opacity-60" />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(32,162,150,0.22),transparent_55%)]"
          />
          <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-16">
            <div className="max-w-2xl">
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-white/60">
                Milestone 1 preview
              </span>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Start with the participant journey.
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/55 sm:text-base">
                Explore the demo workspace to see the dashboard, session
                history, and role-based navigation. All data is synthetic.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/participant" variant="inverse" size="lg">
                Open participant demo
                <ArrowRight aria-hidden="true" className="size-4" />
              </ButtonLink>
              <ButtonLink
                href="/login"
                variant="outline-inverse"
                size="lg"
              >
                View sign-in scaffold
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
