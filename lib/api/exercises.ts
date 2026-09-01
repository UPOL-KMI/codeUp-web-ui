import "server-only";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import { apiRead } from "./read";

/**
 * The exercise catalog, as the "assign one to this group" picker reads it (T-001).
 *
 * `/v1/exercises` answers a **paginated envelope** (`{items, totalCount, offset, limit, ...}`),
 * unlike `/v1/groups`, which is a bare array -- the same inconsistency `app/api/search/route.ts`
 * already had to normalise, restated here because this is the second consumer and the shape is
 * easy to get wrong once.
 *
 * `canAssign` is core-api's own hint on the exercise. It is **not the whole precondition**:
 * `AssignmentsPresenter::actionCreate` also refuses a locked exercise, a broken one, and one with
 * no reference solution. The first two are in this payload and are reported here; the third is
 * not, so the picker cannot know it in advance and core-api's own message is what the reader gets
 * on the attempt. Guessing it would mean a second round trip per row to find out.
 */
export interface AssignableExercise {
  id: string;
  name: string;
  difficulty: string;
  environments: string[];
  isLocked: boolean;
  isBroken: boolean;
  canAssign: boolean;
}

interface ExercisePayload {
  id: string;
  localizedTexts?: LocalizedText[];
  difficulty: string;
  runtimeEnvironments?: { id: string }[];
  isLocked: boolean;
  isBroken: boolean;
  permissionHints?: Record<string, boolean>;
}

interface ExerciseEnvelope {
  items: ExercisePayload[];
  totalCount: number;
}

export interface AssignableExercises {
  exercises: AssignableExercise[];
  /** How many the query matched in total, which need not be how many are listed. */
  totalCount: number;
}

const PAGE_SIZE = 25;

export async function getAssignableExercises(
  locale: string,
  search: string,
): Promise<AssignableExercises> {
  const envelope = await apiRead<ExerciseEnvelope>("/v1/exercises", {
    query: {
      limit: PAGE_SIZE,
      offset: 0,
      ...(search !== "" && { search }),
    },
  });

  return {
    totalCount: envelope.totalCount,
    exercises: envelope.items.map((exercise) => ({
      id: exercise.id,
      name: localizedName(exercise.localizedTexts, locale),
      difficulty: exercise.difficulty,
      environments: (exercise.runtimeEnvironments ?? []).map((environment) => environment.id),
      isLocked: exercise.isLocked,
      isBroken: exercise.isBroken,
      canAssign: exercise.permissionHints?.assign === true,
    })),
  };
}
