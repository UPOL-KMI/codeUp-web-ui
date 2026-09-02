"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

/**
 * Live evaluation progress (S-016): what happens on the solution screen while the pipeline is
 * still running.
 *
 * **Two mechanisms, because they answer two different questions** (DEC-062):
 *
 * - **The monitor WebSocket** reports the job task by task, in real time. Its channel id exists
 *   only in the response to the submit that created the job, so it arrives here as `?monitor=` on
 *   the URL the submit form navigated to -- there is no way to ask core-api for it later, which is
 *   exactly why it cannot be the only mechanism.
 * - **Refreshing the page on a timer** works for any pending solution, opened at any time, from
 *   any device. It re-runs the Server Component, so the moment the evaluation lands the whole
 *   screen becomes the real result -- no second, client-side rendering of the test table that
 *   could disagree with the server's.
 *
 * The socket connects **directly to the monitor**, bypassing this app's BFF entirely, exactly as
 * the legacy app does; the monitor is unauthenticated by design and its messages carry only task
 * states, no solution data. The URL is this deployment's own `MONITOR_WS_URL`, passed in from the
 * server -- not a URL taken from the page's query string, which would be an open redirect for
 * sockets.
 *
 * Polling stops when the evaluation arrives, when the tab is hidden, and after `MAX_POLLS` in any
 * case: an evaluation that has not finished in five minutes is not going to be finished by asking
 * more often, and a forgotten tab must not poll a teaching instance forever.
 */
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 60;

/**
 * The monitor's own wire format, confirmed against a live job rather than read off the docs:
 * `{"command": "DOWNLOADED"}`, `{"command": "STARTED"}`, then one
 * `{"command": "TASK", "task_id": "...", "task_state": "COMPLETED"}` per task, and finally
 * `{"command": "FAILED"}` or `{"command": "FINISHED"}`. The channel id is sent by the client as
 * the socket's first message; the monitor replays what it has already seen on that channel, so
 * connecting a moment late loses nothing.
 */
interface MonitorMessage {
  command?: string;
  task_state?: string;
}

export function EvaluationProgress({
  channelId,
  monitorUrl,
  expectedTasks,
}: {
  /** The monitor channel (core-api's job id), or null when this page was not opened from a submit. */
  channelId: string | null;
  monitorUrl: string | null;
  expectedTasks: number;
}) {
  const t = useTranslations("Solution.progress");
  const router = useRouter();
  const [done, setDone] = useState(0);
  const [failedTasks, setFailedTasks] = useState(0);
  const [jobFailed, setJobFailed] = useState(false);

  useEffect(() => {
    let polls = 0;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (++polls > MAX_POLLS) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    if (!channelId || !monitorUrl) return;

    let socket: WebSocket;
    try {
      socket = new WebSocket(monitorUrl);
    } catch {
      // A browser without WebSocket support, or a blocked connection: the poll above is the whole
      // mechanism then, which is why it is not conditional on this one.
      return;
    }

    socket.onopen = () => socket.send(channelId);
    socket.onmessage = (event: MessageEvent<string>) => {
      let message: MonitorMessage;
      try {
        message = JSON.parse(event.data) as MonitorMessage;
      } catch {
        return;
      }
      if (message.command === "TASK") {
        setDone((count) => count + 1);
        if (message.task_state === "FAILED") setFailedTasks((count) => count + 1);
      } else if (message.command === "FAILED") {
        setJobFailed(true);
        // A failed job is over, and what it recorded is core-api's to tell -- as for FINISHED.
        router.refresh();
      } else if (message.command === "FINISHED") {
        socket.close();
        // The job is over; the authority on *what happened* is core-api, not this socket.
        router.refresh();
      }
    };

    return () => socket.close();
  }, [channelId, monitorUrl, router]);

  const percent =
    expectedTasks > 0 ? Math.min(100, Math.round((done / expectedTasks) * 100)) : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
    >
      <p className="text-sm">
        {percent !== null ? t("running", { done, total: expectedTasks }) : t("waiting")}
      </p>
      {(jobFailed || failedTasks > 0) && (
        <p className="text-sm text-destructive">
          {jobFailed ? t("failed") : t("stepsFailed", { failed: failedTasks })}
        </p>
      )}
      {percent !== null && (
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={expectedTasks}
          aria-valuenow={done}
        >
          <div
            className={`h-full ${jobFailed || failedTasks > 0 ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("autoRefresh")}</p>
    </div>
  );
}
