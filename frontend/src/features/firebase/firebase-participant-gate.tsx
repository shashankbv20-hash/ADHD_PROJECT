"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirebaseAuth } from "@/features/auth/firebase-auth-provider";
import {
  ApiBackedActivityProvider,
  FirebaseDirectActivityProvider,
} from "@/features/backend/activity-providers";
import { BackendSyncProvider } from "@/features/backend/backend-sync-provider";
import { CaregiverProvider } from "@/features/caregiver/caregiver-provider";
import { getFrontendConfig } from "@/lib/config/frontend-config";
import {
  portalLabels,
  portalRoutes,
  type PortalRole,
} from "@/features/auth/portal-role";

function FirebaseLoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-line bg-surface p-6 text-sm text-ink-muted"
    >
      Loading Firebase account…
    </div>
  );
}

function FirebaseSignedOut() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to your account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-ink-muted">
          Firebase mode does not display synthetic records. Sign in with an
          authorized account to continue.
        </p>
        <ButtonLink href="/login">Sign in</ButtonLink>
      </CardContent>
    </Card>
  );
}

function FirebaseStaffUnavailable({
  role,
  actionError,
  onSignOut,
}: {
  role: PortalRole;
  actionError: string | null;
  onSignOut: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{portalLabels[role]} workspace authorized</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert tone="info" title="Trusted staff role verified">
          Your Firebase account carries a verified {portalLabels[role].toLowerCase()} role
          claim. This frontend does not yet include a staff data integration, so
          no participant or cross-participant records are shown.
        </Alert>
        {actionError ? (
          <Alert tone="danger" title="Account action failed">
            {actionError}
          </Alert>
        ) : null}
        <p className="text-sm leading-6 text-ink-muted">
          The participant workspace remains isolated from staff accounts. Role
          claims are issued only by a trusted administrative process.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FirebasePortalMismatch({
  requested,
  authorized,
  actionError,
  onSignOut,
}: {
  requested: PortalRole;
  authorized: PortalRole;
  actionError: string | null;
  onSignOut: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portal access denied</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert tone="warning" title="This account is not authorized for that portal">
          The {portalLabels[requested].toLowerCase()} portal requires a verified{" "}
          {portalLabels[requested].toLowerCase()} role. This account is
          authorized for the {portalLabels[authorized].toLowerCase()} portal.
        </Alert>
        {actionError ? (
          <Alert tone="danger" title="Account action failed">
            {actionError}
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={portalRoutes[authorized]}>
            Open {portalLabels[authorized]} portal
          </ButtonLink>
          <Button variant="outline" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function FirebaseParticipantGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useFirebaseAuth();
  const pathname = usePathname();
  const [actionError, setActionError] = useState<string | null>(null);
  const config = getFrontendConfig();
  const apiBaseUrl = config.valid ? config.apiBaseUrl : null;
  const caregiverRoute = pathname.startsWith("/caregiver");
  const staffRoute: PortalRole | null = pathname.startsWith("/clinician")
    ? "clinician"
    : pathname.startsWith("/research")
      ? "researcher"
      : null;

  const signOut = () => {
    setActionError(null);
    void auth.signOutUser().catch((error: unknown) =>
      setActionError(
        error instanceof Error ? error.message : "Sign-out failed.",
      ),
    );
  };

  if (auth.status === "loading" || auth.status === "loading-account") {
    return <FirebaseLoadingState />;
  }

  if (auth.status === "unavailable") {
    return (
      <Alert tone="danger" title="Firebase is unavailable">
        {auth.error?.message ??
          "Firebase could not be initialized. Check the public Firebase Web App configuration for this build."}
      </Alert>
    );
  }

  if (auth.status === "signed-out" || !auth.user) {
    return <FirebaseSignedOut />;
  }

  if (caregiverRoute) {
    if (!auth.authorizedRole) {
      return (
        <Alert tone="warning" title="Caregiver role could not be verified">
          The account is signed in, but its role claim is unavailable. Nothing is shown. Sign out and
          try again.
        </Alert>
      );
    }

    if (auth.authorizedRole !== "caregiver") {
      return (
        <FirebasePortalMismatch
          requested="caregiver"
          authorized={auth.authorizedRole}
          actionError={actionError}
          onSignOut={signOut}
        />
      );
    }

    if (!apiBaseUrl) {
      return (
        <Alert tone="info" title="Caregiver access needs the research backend">
          This build is not connected to the research backend, so there is nothing to show.
        </Alert>
      );
    }

    return (
      <CaregiverProvider key={auth.user.uid} user={auth.user} baseUrl={apiBaseUrl}>
        {children}
      </CaregiverProvider>
    );
  }

  if (staffRoute) {
    if (!auth.authorizedRole) {
      return (
        <Alert tone="warning" title="Staff role could not be verified">
          The account is signed in, but its role claim is unavailable. No staff
          records are shown. Sign out and try again.
        </Alert>
      );
    }

    if (auth.authorizedRole !== staffRoute) {
      return (
        <FirebasePortalMismatch
          requested={staffRoute}
          authorized={auth.authorizedRole}
          actionError={actionError}
          onSignOut={signOut}
        />
      );
    }

    return (
      <FirebaseStaffUnavailable
        role={staffRoute}
        actionError={actionError}
        onSignOut={signOut}
      />
    );
  }

  if (
    auth.authorizedRole === "caregiver" ||
    auth.authorizedRole === "clinician" ||
    auth.authorizedRole === "researcher"
  ) {
    return (
      <FirebasePortalMismatch
        requested="participant"
        authorized={auth.authorizedRole}
        actionError={actionError}
        onSignOut={signOut}
      />
    );
  }

  if (auth.status === "profile-error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Participant profile setup needs attention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert tone="danger" title="Account profile unavailable">
            {auth.error?.message ??
              "Firebase authenticated this account, but its participant profile could not be loaded."}
          </Alert>
          {actionError ? (
            <Alert tone="danger" title="Account action failed">
              {actionError}
            </Alert>
          ) : null}
          <p className="text-sm leading-6 text-ink-muted">
            Retrying checks or creates only this account&apos;s own participant
            profile. Public registration cannot assign staff roles.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setActionError(null);
                void auth.retryProfileSetup().catch((error: unknown) =>
                  setActionError(
                    error instanceof Error
                      ? error.message
                      : "Profile recovery could not be completed.",
                  ),
                );
              }}
            >
              Retry profile setup
            </Button>
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (auth.status === "account-error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account data could not be loaded</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert tone="danger" title="Firebase account data unavailable">
            {auth.error?.message ??
              "Firebase Authentication succeeded, but the participant records could not be read."}
          </Alert>
          <p className="text-sm leading-6 text-ink-muted">
            No demonstration records are substituted. Check network access and
            Firestore Rules, then retry.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setActionError(null);
                void auth.reloadAccount().catch((error: unknown) =>
                  setActionError(
                    error instanceof Error
                      ? error.message
                      : "Account data could not be reloaded.",
                  ),
                );
              }}
            >
              Retry loading account data
            </Button>
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </div>
          {actionError ? (
            <Alert tone="danger" title="Account action failed">
              {actionError}
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (!auth.account) {
    return (
      <Alert tone="warning" title="Participant profile unavailable">
        The account is signed in, but no participant profile was loaded. Sign
        out and try again or contact the research team.
      </Alert>
    );
  }

  const accountNotice = auth.error ? (
    <Alert tone="danger" title="Account refresh failed">
      {auth.error.message} Previously loaded account records and local runs
      remain available; no demo records were substituted.
    </Alert>
  ) : null;

  // With an API base URL, CPT runs are saved through the backend (after explicit
  // consent) instead of directly to Firestore. Never both for the same operation.
  if (apiBaseUrl) {
    return (
      <BackendSyncProvider key={auth.user.uid} user={auth.user} baseUrl={apiBaseUrl}>
        <ApiBackedActivityProvider
          participantId={auth.user.uid}
          legacyRuns={auth.account.activityRuns}
        >
          {accountNotice}
          {children}
        </ApiBackedActivityProvider>
      </BackendSyncProvider>
    );
  }

  return (
    <FirebaseDirectActivityProvider
      key={auth.user.uid}
      participantId={auth.user.uid}
      cloudSyncEnabled={auth.account.profile.cloudSyncEnabled}
      initialRuns={auth.account.activityRuns}
    >
      {accountNotice}
      {children}
    </FirebaseDirectActivityProvider>
  );
}
