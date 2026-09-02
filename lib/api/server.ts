import "server-only";

import { apiRead } from "./read";

/**
 * The backend services this deployment runs on (AD-006): the ZeroMQ broker that hands evaluation
 * jobs to workers, and core-api's own background job queue.
 *
 * **This is what the legacy "Server management" page actually is.** `BACKLOG.md` promised "runtime
 * environments, hardware groups"; the legacy `ServerManagement` page contains neither, and neither
 * has an administration screen anywhere in that app -- they are read-only vocabularies that appear
 * where exercises are configured (T-009) and where their limits are set (T-010), both already
 * built here. What the page does contain is these two panels (DEC-114).
 *
 * Both are the superadmin's: `permissions.neon` has no `resource: broker` rule at all, so only the
 * blanket superadmin allow reaches it, and pinging the async worker is the same. Verified live --
 * a supervisor is refused both with 403.
 */
export interface BrokerStats {
  /** core-api answers a flat map of strings, so the panel renders whatever it is given. */
  entries: [string, string][];
  /** Read out of the same map: the broker refuses new work while this is set. */
  isFrozen: boolean;
}

export async function getBrokerStats(): Promise<BrokerStats> {
  const payload = await apiRead<Record<string, string | number | boolean>>("/v1/broker/stats");
  const entries = Object.entries(payload).map(
    ([key, value]) => [key, String(value)] as [string, string],
  );

  // "0"/"1" rather than a JSON boolean, which is why this is not simply truthiness: the string
  // "0" is true in JavaScript and would report a running broker as frozen.
  const frozen = payload["is-frozen"];
  return { entries, isFrozen: frozen !== undefined && String(frozen) !== "0" };
}

/**
 * A job core-api runs outside the request that asked for it -- re-evaluating every solution of an
 * assignment after its configuration changed, and the like.
 *
 * `arguments` is whatever that command needs and has no shape in common between commands, so it is
 * kept as core-api sent it and rendered as text.
 */
export interface AsyncJob {
  id: string;
  command: string;
  arguments: unknown;
  createdAt: number;
  scheduledAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  retries: number;
  workerId: string | null;
  error: string | null;
  associatedAssignmentId: string | null;
}

/**
 * Pending jobs and those finished within the last hour, scheduled ones included -- the same window
 * the legacy page asks for (`fetchAllJobs(includeScheduled = true, ageThreshold = 3600)`). Without
 * `ageThreshold` core-api returns only what is still pending, which on a healthy deployment is an
 * empty table that says nothing about whether the handler is alive.
 */
export const ASYNC_JOB_WINDOW_SECONDS = 3600;

export async function getAsyncJobs(): Promise<AsyncJob[]> {
  const payload = await apiRead<
    {
      id: string;
      command?: string;
      arguments?: unknown;
      createdAt?: number;
      scheduledAt?: number | null;
      startedAt?: number | null;
      finishedAt?: number | null;
      retries?: number;
      workerId?: string | null;
      error?: string | null;
      associatedAssignment?: string | null;
    }[]
  >("/v1/async-jobs", {
    query: { ageThreshold: ASYNC_JOB_WINDOW_SECONDS, includeScheduled: true },
  });

  return payload
    .map((job) => ({
      id: job.id,
      command: job.command ?? "",
      arguments: job.arguments ?? null,
      createdAt: job.createdAt ?? 0,
      scheduledAt: job.scheduledAt ?? null,
      startedAt: job.startedAt ?? null,
      finishedAt: job.finishedAt ?? null,
      retries: job.retries ?? 0,
      workerId: job.workerId ?? null,
      error: job.error ?? null,
      associatedAssignmentId: job.associatedAssignment ?? null,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}
