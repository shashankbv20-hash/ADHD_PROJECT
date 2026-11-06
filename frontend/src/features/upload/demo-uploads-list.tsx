"use client";

import { ArrowRight, UploadCloud } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useDemoSessions } from "@/features/upload/demo-session-store";
import { UploadStatusBadge } from "@/features/upload/upload-status-badge";
import { formatDateTime } from "@/lib/utils";

export function DemoUploadsList() {
  const { sessions } = useDemoSessions();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo uploads</CardTitle>
        <CardDescription>
          Files added through the demo upload flow in this browser session.
          These records are held in memory and reset on reload.
        </CardDescription>
      </CardHeader>

      {sessions.length === 0 ? (
        <CardContent>
          <EmptyState
            icon={UploadCloud}
            title="No demo uploads yet"
            description="Upload a synthetic EEG file to preview validation, simulated processing, and the metadata-only session record."
            action={
              <ButtonLink href="/participant/upload">
                Upload demo EEG
              </ButtonLink>
            }
          />
        </CardContent>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">
              In-memory demo uploads with file metadata, status, and workflow
              actions.
            </caption>
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-subtle">
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Session
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  File
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Protocol
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Added
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  Status
                </th>
                <th scope="col" className="px-5 py-2.5 font-medium">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const complete = session.status === "complete";
                const href = complete
                  ? `/participant/sessions/${session.id}`
                  : `/participant/upload/processing/${session.id}`;

                return (
                  <tr
                    key={session.id}
                    className="border-b border-line/70 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs font-medium text-ink">
                      {session.id}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      <span className="block max-w-[240px] truncate">
                        {session.fileName}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {session.protocol}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-ink-muted">
                      {formatDateTime(session.uploadedAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <UploadStatusBadge status={session.status} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <Link
                        href={href}
                        className="inline-flex items-center gap-1 rounded text-sm font-medium text-brand-800 transition-colors hover:text-brand-600"
                      >
                        {complete ? "View record" : "Continue"}
                        <ArrowRight
                          aria-hidden="true"
                          className="size-3.5"
                        />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CardFooter>
        <p className="text-xs text-ink-subtle">
          {sessions.length} in-memory demo upload
          {sessions.length === 1 ? "" : "s"}
        </p>
        <span className="text-xs text-ink-subtle">Not persisted</span>
      </CardFooter>
    </Card>
  );
}
