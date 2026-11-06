import { ApiClientError, ServiceUnavailableError } from "@/lib/api-client";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import { getDemoRole } from "@/lib/demo/demo-session-server";
import type { PortalRole } from "@/features/auth/portal-role";

export type DemoServiceLoad<Result> =
  | { available: true; data: Result }
  | { available: false };

export async function loadDemoService<Result>(
  load: () => Promise<Result>,
  requiredRole?: PortalRole,
): Promise<DemoServiceLoad<Result>> {
  const config = getFrontendConfig();
  const demoRole =
    config.valid && config.provider === "remote" ? null : await getDemoRole();
  const demoProviderActive = config.valid && config.provider === "demo";

  if (!demoProviderActive && !demoRole) {
    return { available: false };
  }

  if (demoRole && requiredRole && demoRole !== requiredRole) {
    return { available: false };
  }

  return { available: true, data: await load() };
}

export function selectDataProvider<Service>(
  demoService: Service,
  remoteService: Service,
  firebaseService: Service,
): Service {
  const config = getFrontendConfig();

  if (config.valid && config.provider === "demo") {
    return demoService;
  }

  if (config.valid && config.provider === "firebase") {
    return firebaseService;
  }

  return remoteService;
}

export function getRemoteIntegrationError(
  serviceName: string,
  operationName: string,
): ApiClientError {
  const config = getFrontendConfig();

  if (!config.valid) {
    return new ApiClientError(config.error, {
      kind: "configuration",
      code: "invalid-frontend-configuration",
    });
  }

  if (config.provider !== "remote") {
    return new ServiceUnavailableError(
      `${serviceName}.${operationName} is not available from the selected provider.`,
      "unsupported",
    );
  }

  if (!config.apiBaseUrl) {
    return new ServiceUnavailableError(
      `${serviceName}.${operationName} is unavailable because NEXT_PUBLIC_API_BASE_URL is not configured. No demo data was substituted.`,
      "not-configured",
    );
  }

  return new ServiceUnavailableError(
    `${serviceName}.${operationName} is unavailable because its backend endpoint and response contract have not been confirmed. The configured base URL is not called, and no demo data was substituted.`,
    "contract-unconfirmed",
  );
}
