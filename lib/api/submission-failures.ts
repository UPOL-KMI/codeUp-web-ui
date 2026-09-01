import "server-only";

import { apiRead } from "./read";

/**
 * Every submission that never became a result (T-019).
 *
 * The one screen in this app that is about the *machine* rather than about anybody's work: a job
 * the broker refused, an evaluation that died, results that could not be read back, an exercise
 * configuration that will not compile. core-api records each one and keeps it until somebody says
 * it has been dealt with.
 *
 * **Two scopes, both core-api's own.** `/v1/submission-failures` is every failure ever recorded
 * and grows without bound -- it is neither paginated nor filtered server-side -- while
 * `/v1/submission-failures/unresolved` is the working queue. This app defaults to the queue
 * (DEC-096); the legacy page fetches the whole history every time and offers no way to ask for
 * anything else.
 *
 * A failure carries **no `permissionHints`** -- verified live, the key is absent -- so whether a
 * reader may resolve one is not something this screen can ask in advance. Whoever core-api lets
 * list them is offered the action, and `canResolve` decides for real on the call.
 */
export type FailureScope = "unresolved" | "all";

/** core-api's own five (`SubmissionFailure::TYPE_*`), plus a catch-all for one added later. */
export const FAILURE_TYPES = [
  "broker_reject",
  "evaluation_failure",
  "loading_failure",
  "config_error",
  "soft_config_error",
] as const;

export type FailureType = (typeof FAILURE_TYPES)[number] | "other";

export interface SubmissionFailure {
  id: string;
  type: FailureType;
  description: string;
  createdAt: number;
  resolvedAt: number | null;
  resolutionNote: string;
  /** The student's solution this happened to, when it was one. */
  solutionId: string | null;
  /** A reference solution instead -- no screen of this app shows one yet (T-011). */
  referenceSolutionId: string | null;
  exerciseId: string | null;
}

interface FailurePayload {
  id: string;
  type: string;
  description: string;
  createdAt: number;
  resolvedAt: number | null;
  resolutionNote: string | null;
  assignmentSolutionId: string | null;
  assignmentId: string | null;
  referenceSolutionId: string | null;
  exerciseId: string | null;
}

function failureType(type: string): FailureType {
  return (FAILURE_TYPES as readonly string[]).includes(type) ? (type as FailureType) : "other";
}

export async function getSubmissionFailures(scope: FailureScope): Promise<SubmissionFailure[]> {
  const failures = await apiRead<FailurePayload[]>(
    scope === "unresolved" ? "/v1/submission-failures/unresolved" : "/v1/submission-failures",
  );

  return (
    failures
      .map((failure) => ({
        id: failure.id,
        type: failureType(failure.type),
        description: failure.description,
        createdAt: failure.createdAt,
        resolvedAt: failure.resolvedAt,
        resolutionNote: failure.resolutionNote ?? "",
        solutionId: failure.assignmentSolutionId,
        referenceSolutionId: failure.referenceSolutionId,
        exerciseId: failure.exerciseId,
      }))
      // Newest first: core-api returns them in no particular order, and the failure somebody is
      // here about is almost always the one that just happened.
      .sort((a, b) => b.createdAt - a.createdAt)
  );
}
