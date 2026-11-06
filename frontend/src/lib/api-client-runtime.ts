import { createApiClient, type ApiRequestOptions } from "@/lib/api-client";
import { getFrontendConfig } from "@/lib/config/frontend-config";

const frontendConfig = getFrontendConfig();
const remoteProviderActive =
  frontendConfig.valid && frontendConfig.provider === "remote";

export const apiClient = createApiClient({
  baseUrl: remoteProviderActive ? frontendConfig.apiBaseUrl : null,
  configurationError: frontendConfig.valid ? undefined : frontendConfig.error,
});

export function isApiConfigured(): boolean {
  const config = getFrontendConfig();
  return (
    config.valid && config.provider === "remote" && config.apiBaseUrl !== null
  );
}

/** Backwards-compatible convenience wrapper around the configured client. */
export function apiRequest<Payload>(
  path: string,
  options?: ApiRequestOptions,
): Promise<Payload> {
  return apiClient.requestJson<Payload>(path, options);
}
