import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { getFrontendConfig, type FrontendConfig } from "@/lib/config/frontend-config";

export function DataProviderUnavailable({
  config = getFrontendConfig(),
}: {
  config?: FrontendConfig;
}) {
  const configurationInvalid = !config.valid;
  const apiConfigured = config.valid && config.apiBaseUrl !== null;

  const title = configurationInvalid
    ? "Frontend data-provider configuration is invalid"
    : apiConfigured
      ? "Remote API contracts are not confirmed"
      : "Remote API is not configured";

  const description = configurationInvalid
    ? config.error
    : apiConfigured
      ? "A base URL is set, but no verified endpoint paths, methods, or response schemas are available. No request was sent and demonstration data was not substituted."
      : "Remote mode is selected without a backend base URL. No request was sent and demonstration data was not substituted.";

  return (
    <section
      aria-labelledby="provider-unavailable-title"
      className="mx-auto w-full max-w-3xl space-y-4 py-8"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">
          Frontend integration status
        </p>
        <h1
          id="provider-unavailable-title"
          className="mt-1 text-2xl font-semibold tracking-tight text-ink"
        >
          {title}
        </h1>
      </div>

      <Alert tone={configurationInvalid ? "danger" : "warning"} title={title}>
        {description}
      </Alert>

      <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink">What you can do</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink-muted">
          <li>
            Set <code className="font-mono text-xs">NEXT_PUBLIC_DATA_PROVIDER=demo</code>{" "}
            to use the existing labelled demonstration workspace.
          </li>
          <li>
            Keep remote mode disabled until the backend team confirms endpoint
            mappings, payload schemas, authentication boundaries, and EEG upload
            transport.
          </li>
          <li>
            A configured base URL alone does not enable network requests.
          </li>
        </ul>
      </div>

      <ButtonLink href="/" variant="outline">
        Return to public overview
      </ButtonLink>
    </section>
  );
}
