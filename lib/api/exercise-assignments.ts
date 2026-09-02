import "server-only";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import { stalePartsOf, type SynchronizationInfo } from "./assignment";
import { apiGet } from "./client";
import { getGroupList } from "./groups";
import { pageRead } from "./read";

/**
 * The assignments made from one exercise (T-012).
 *
 * T-021's screen counts them, which is what says an exercise is in use; this is the list behind
 * that number, and the reason it is worth its own screen: changing an exercise does **not** change
 * an assignment made from it -- an assignment is a snapshot, and re-synchronising one is a
 * deliberate act on its own settings screen (T-002). So the useful question here is not "what did
 * I write" but "who is already using it, and how far behind are they".
 *
 * **core-api filters the list by what the reader may see**, so a teacher looking at a public
 * exercise sees the assignments in their own groups and not the rest of the instance's. The count
 * on T-021 is the same filtered number, and neither is the instance's total.
 *
 * Each row carries which parts of the exercise it has fallen behind on, read through the same
 * `stalePartsOf` rule S-013's notice uses -- so this screen answers, in one place, the question
 * that otherwise takes one visit per assignment: after editing an exercise, who is out of date.
 */
export interface ExerciseAssignmentRow {
  id: string;
  name: string;
  groupId: string;
  /** The group's name where the reader may see it; the id is all core-api gives otherwise. */
  groupName: string | null;
  isPublic: boolean;
  firstDeadline: number;
  secondDeadline: number;
  allowSecondDeadline: boolean;
  maxPoints: number;
  version: number;
  /** Which parts of the exercise this assignment has fallen behind on, if any. */
  staleParts: string[];
  /** Whether core-api would let it be re-synchronised at all. */
  syncPossible: boolean;
  environments: string[];
}

interface AssignmentPayload {
  id: string;
  version: number;
  localizedTexts?: LocalizedText[];
  groupId: string;
  isPublic: boolean;
  firstDeadline: number;
  secondDeadline: number;
  allowSecondDeadline: boolean;
  maxPointsBeforeFirstDeadline: number;
  runtimeEnvironmentIds?: string[];
  exerciseSynchronizationInfo?: SynchronizationInfo;
}

export async function getExerciseAssignments(
  exerciseId: string,
  locale: string,
): Promise<ExerciseAssignmentRow[]> {
  const [assignments, groups] = await Promise.all([
    pageRead(
      apiGet<AssignmentPayload[]>("/v1/exercises/{id}/assignments", {
        pathParams: { id: exerciseId },
      }),
    ),
    getGroupList(locale),
  ]);

  const groupNames = new Map(groups.map((group) => [group.id, group.name]));

  return assignments
    .map((assignment) => ({
      id: assignment.id,
      name: localizedName(assignment.localizedTexts, locale),
      groupId: assignment.groupId,
      groupName: groupNames.get(assignment.groupId) ?? null,
      isPublic: assignment.isPublic,
      firstDeadline: assignment.firstDeadline,
      secondDeadline: assignment.secondDeadline,
      allowSecondDeadline: assignment.allowSecondDeadline,
      maxPoints: assignment.maxPointsBeforeFirstDeadline,
      version: assignment.version,
      staleParts: stalePartsOf(assignment.exerciseSynchronizationInfo),
      syncPossible: assignment.exerciseSynchronizationInfo?.isSynchronizationPossible === true,
      environments: assignment.runtimeEnvironmentIds ?? [],
    }))
    .sort(
      (a, b) =>
        (a.groupName ?? "").localeCompare(b.groupName ?? "") || a.firstDeadline - b.firstDeadline,
    );
}
