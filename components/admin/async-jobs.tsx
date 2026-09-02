"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { abortAsyncJob, pingAsyncWorker } from "@/lib/actions/server";
import type { AsyncJob } from "@/lib/api/server";
import { DATE_TIME_SECONDS_FORMAT } from "@/lib/format/date-time";

import { Link, useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { Badge } from "@/components/status/badge";
import { useToast } from "@/components/toast/toast-provider";

/**
 * core-api's background job queue (AD-006): what it is chewing on, and what it finished in the
 * last hour.
 *
 * **An empty table means two different things, and Ping is how they are told apart.** A deployment
 * with nothing to do looks exactly like one whose async handler has died; a ping is an empty job
 * whose only purpose is to come back finished, so a ping that stays unfinished is the answer.
 *
 * A job's state is four timestamps rather than a status field -- created, scheduled, started,
 * finished -- so the badge is derived from which of them are set, in that order. `arguments` has
 * no shape in common between commands, so it is printed as JSON rather than given columns it
 * cannot fill.
 */
export function AsyncJobs({ jobs, windowSeconds }: { jobs: AsyncJob[]; windowSeconds: number }) {
  const t = useTranslations("Server.jobs");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const [aborting, setAborting] = useState<AsyncJob | null>(null);
  const [pending, setPending] = useState(false);

  async function ping() {
    setPending(true);
    const result = await pingAsyncWorker();
    setPending(false);
    if (!result.success) {
      toast.error(t("pingFailed"), result.formError);
      return;
    }
    toast.success(t("pinged"));
    router.refresh();
  }

  async function abort() {
    if (!aborting) return;
    setPending(true);
    const result = await abortAsyncJob(aborting.id);
    setPending(false);
    if (!result.success) {
      toast.error(t("abortFailed"), result.formError);
      return;
    }
    setAborting(null);
    toast.success(t("aborted"));
    router.refresh();
  }

  const at = (unixSeconds: number | null) =>
    unixSeconds === null || unixSeconds === 0 ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <time dateTime={new Date(unixSeconds * 1000).toISOString()}>
        {format.dateTime(new Date(unixSeconds * 1000), DATE_TIME_SECONDS_FORMAT)}
      </time>
    );

  const button =
    "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {t("window", { minutes: Math.round(windowSeconds / 60) })}
      </p>

      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("columns.command")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("columns.created")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("columns.finished")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("columns.state")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("columns.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <span className="flex flex-col gap-1">
                      <span className="font-mono text-xs">{job.command || "—"}</span>
                      {job.arguments !== null &&
                        JSON.stringify(job.arguments) !== "[]" &&
                        JSON.stringify(job.arguments) !== "{}" && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {JSON.stringify(job.arguments)}
                          </span>
                        )}
                      {job.error && <span className="text-xs text-destructive">{job.error}</span>}
                      {job.associatedAssignmentId && (
                        <Link
                          href={`/assignments/${job.associatedAssignmentId}`}
                          className="text-xs hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {t("assignment")}
                        </Link>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                    {at(job.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                    {at(job.finishedAt)}
                  </td>
                  <td className="px-3 py-2">
                    {job.finishedAt ? (
                      <Badge tone={job.error ? "danger" : "neutral"}>
                        {t(job.error ? "state.failed" : "state.done")}
                      </Badge>
                    ) : job.startedAt ? (
                      <Badge tone="info">{t("state.running")}</Badge>
                    ) : job.scheduledAt ? (
                      <Badge tone="warning">{t("state.scheduled")}</Badge>
                    ) : (
                      <Badge tone="success">{t("state.waiting")}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {job.finishedAt === null ? (
                      <button
                        type="button"
                        className="rounded-md border border-input px-2 py-1 text-xs text-destructive hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        onClick={() => setAborting(job)}
                      >
                        {t("abort")}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => router.refresh()}>
          {t("refresh")}
        </button>
        <button type="button" disabled={pending} className={button} onClick={() => void ping()}>
          {t("ping")}
        </button>
      </div>

      <ConfirmDialog
        open={aborting !== null}
        onOpenChange={(open) => !open && setAborting(null)}
        title={t("abort")}
        description={t("confirmAbort", { command: aborting?.command ?? "" })}
        confirmLabel={t("abort")}
        pending={pending}
        onConfirm={() => void abort()}
      />
    </div>
  );
}
