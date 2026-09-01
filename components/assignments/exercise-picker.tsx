"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { createAssignmentFromExercise } from "@/lib/actions/assignment";
import type { AssignableExercise } from "@/lib/api/exercises";

import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/status/badge";

/**
 * Choosing the exercise to assign (T-001).
 *
 * Assigning creates the assignment with core-api's defaults and goes straight to its settings
 * (T-002), because there is no call that does both -- so the reader lands where the deadline and
 * the points are, with the thing already real. That is the legacy flow too.
 *
 * A row that cannot be assigned says why *where it is known*: locked, broken, or simply not this
 * reader's to assign. The one precondition no list payload carries -- an exercise with no
 * reference solution -- surfaces as core-api's own message on the attempt, which is why a failure
 * here is shown verbatim rather than replaced with a generic sentence.
 */
export function ExercisePicker({
  exercises,
  groupId,
}: {
  exercises: AssignableExercise[];
  groupId: string;
}) {
  const t = useTranslations("AssignExercise");
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function assign(exerciseId: string) {
    setPending(exerciseId);
    setError(null);
    const result = await createAssignmentFromExercise(exerciseId, groupId);
    if (result.success) {
      router.push(`/assignments/${result.data.assignmentId}/edit`);
      return;
    }
    setPending(null);
    setError(result.formError ?? t("errors.createFailed"));
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {exercises.map((exercise) => {
          const blocked = exercise.isLocked || exercise.isBroken || !exercise.canAssign;
          return (
            <li
              key={exercise.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{exercise.name || t("untitled")}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{t(`difficulty.${exercise.difficulty}`)}</span>
                  {exercise.environments.length > 0 && (
                    <span>{exercise.environments.join(", ")}</span>
                  )}
                  {exercise.isLocked && <Badge tone="warning">{t("locked")}</Badge>}
                  {exercise.isBroken && <Badge tone="danger">{t("broken")}</Badge>}
                </span>
              </span>
              {blocked ? (
                <span className="text-xs text-muted-foreground">
                  {exercise.isBroken
                    ? t("cannot.broken")
                    : exercise.isLocked
                      ? t("cannot.locked")
                      : t("cannot.notYours")}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void assign(exercise.id)}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                >
                  {pending === exercise.id ? t("assigning") : t("assign")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
