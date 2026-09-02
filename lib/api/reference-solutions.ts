import "server-only";

import { apiGet, apiPost } from "./client";
import { pageRead } from "./read";
import { getRuntimeEnvironments } from "./runtime-environments";
import type { SolutionEvaluation } from "./solution";

/**
 * An exercise's reference solutions (T-011).
 *
 * A reference solution is the author's own answer, submitted through the same pipeline a student's
 * would be -- and it is what proves an exercise is possible at all. **An exercise with none of them
 * cannot be assigned**: core-api refuses, and T-001's picker discovered that from the other side
 * (the refusal is not in any list payload, so the assign attempt is where a teacher meets it).
 * This screen is where that is fixed.
 *
 * The evaluation is the same shape a student's submission has, which is the point: a reference
 * solution is not a special kind of run, it is the exercise's own configuration executed for real.
 * So the results table is literally the same component S-015 renders.
 *
 * **Visibility is a scale, not a flag** -- the levels live in `lib/status/reference-visibility.ts`,
 * where a client component can reach them too.
 */
export interface ReferenceSubmission {
  id: string;
  submittedAt: number;
  isDebug: boolean;
  evaluation: SolutionEvaluation | null;
  failure: { type: string; description: string } | null;
}

export interface ReferenceSolutionRow {
  id: string;
  description: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  environmentId: string;
  environmentName: string;
  visibility: number;
  submissionCount: number;
  lastSubmission: ReferenceSubmission | null;
  can: Record<string, boolean>;
}

interface ReferenceSolutionPayload {
  id: string;
  exerciseId: string;
  description: string;
  authorId: string;
  createdAt: number;
  runtimeEnvironmentId: string;
  visibility: number;
  submissions?: string[];
  lastSubmission?: {
    id: string;
    submittedAt: number;
    isDebug?: boolean;
    evaluation?: SolutionEvaluation | null;
    failure?: { type: string; description: string } | null;
  } | null;
  permissionHints?: Record<string, boolean>;
}

export interface ReferenceSolutionFile {
  id: string;
  name: string;
  size: number;
}

export interface ReferenceSolutionDetail extends ReferenceSolutionRow {
  exerciseId: string;
  files: ReferenceSolutionFile[];
  submissions: ReferenceSubmission[];
}

function submissionOf(
  payload: ReferenceSolutionPayload["lastSubmission"],
): ReferenceSubmission | null {
  if (!payload) return null;
  return {
    id: payload.id,
    submittedAt: payload.submittedAt,
    isDebug: payload.isDebug ?? false,
    evaluation: payload.evaluation ?? null,
    failure: payload.failure ?? null,
  };
}

async function withNames(
  solutions: ReferenceSolutionPayload[],
): Promise<Map<string, { people: Map<string, string>; environments: Map<string, string> }>> {
  const ids = [...new Set(solutions.map((solution) => solution.authorId))];
  const [people, environments] = await Promise.all([
    ids.length > 0
      ? apiPost<{ id: string; fullName: string }[]>("/v1/users/list", { ids })
      : Promise.resolve([]),
    getRuntimeEnvironments(),
  ]);
  return new Map([
    [
      "names",
      {
        people: new Map(people.map((person) => [person.id, person.fullName])),
        environments: new Map(environments.map((entry) => [entry.id, entry.name])),
      },
    ],
  ]);
}

function row(
  solution: ReferenceSolutionPayload,
  people: Map<string, string>,
  environments: Map<string, string>,
): ReferenceSolutionRow {
  return {
    id: solution.id,
    description: solution.description,
    authorId: solution.authorId,
    authorName: people.get(solution.authorId) ?? "",
    createdAt: solution.createdAt,
    environmentId: solution.runtimeEnvironmentId,
    environmentName:
      environments.get(solution.runtimeEnvironmentId) ?? solution.runtimeEnvironmentId,
    visibility: solution.visibility,
    submissionCount: solution.submissions?.length ?? 0,
    lastSubmission: submissionOf(solution.lastSubmission),
    can: solution.permissionHints ?? {},
  };
}

export async function getReferenceSolutions(exerciseId: string): Promise<ReferenceSolutionRow[]> {
  const solutions = await pageRead(
    apiGet<ReferenceSolutionPayload[]>("/v1/reference-solutions/exercise/{exerciseId}", {
      pathParams: { exerciseId },
    }),
  );

  const names = (await withNames(solutions)).get("names")!;
  return solutions
    .map((solution) => row(solution, names.people, names.environments))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getReferenceSolution(solutionId: string): Promise<ReferenceSolutionDetail> {
  const solution = await pageRead(
    apiGet<ReferenceSolutionPayload>("/v1/reference-solutions/{solutionId}", {
      pathParams: { solutionId },
    }),
  );

  const [names, files, submissions] = await Promise.all([
    withNames([solution]),
    apiGet<ReferenceSolutionFile[]>("/v1/reference-solutions/{id}/files", {
      pathParams: { id: solutionId },
    }),
    apiGet<NonNullable<ReferenceSolutionPayload["lastSubmission"]>[]>(
      "/v1/reference-solutions/{solutionId}/submissions",
      { pathParams: { solutionId } },
    ),
  ]);

  const resolved = names.get("names")!;
  return {
    ...row(solution, resolved.people, resolved.environments),
    exerciseId: solution.exerciseId,
    files: files.map((file) => ({ id: file.id, name: file.name, size: file.size })),
    // Newest first: a resubmitted solution's interesting run is the last one, and the older ones
    // are the history of what the exercise used to do to it.
    submissions: submissions
      .map((entry) => submissionOf(entry)!)
      .sort((a, b) => b.submittedAt - a.submittedAt),
  };
}
