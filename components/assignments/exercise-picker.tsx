"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { createAssignmentFromExercise } from "@/lib/actions/assignment";
import type { AssignableExercise } from "@/lib/api/exercises";
import { isDataOnly } from "@/lib/status/exercise-validation";

import { Link, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/status/badge";
import { buttonClasses } from "@/components/button";

/**
 * Choosing the exercise to assign (T-001).
 *
 * Assigning creates the assignment with core-api's defaults and goes straight to its settings
 * (T-002), because there is no call that does both -- so the reader lands where the deadline and
 * the points are, with the thing already real. That is the legacy flow too.
 *
 * A row that cannot be assigned says why, and **all five reasons are known before the click**:
 * locked, broken, no reference solution, or simply not this reader's to assign. DEC-093 recorded
 * the fourth as invisible to any list payload; it is not -- `hasReferenceSolutions` is right there
 * in the response, and T-020 found it while building the catalog on the same endpoint. core-api's
 * own message is still shown verbatim when an attempt fails anyway, since it is the authority.
 */
export function ExercisePicker({
  exercises,
  groupId,
}: {
  exercises: AssignableExercise[];
  groupId: string;
}) {
  const t = useTranslations("AssignExercise");
  // The configuration screen is named once, in `Exercise`, and read from there rather than copied
  // into this namespace -- a second copy of a screen name is how two of them drifted apart before.
  const tExercise = useTranslations("Exercise");
  // core-api serves an empty difficulty for an exercise nobody set one on, and next-intl answers a
  // missing key with the key path -- so the catalog used to show readers `difficulty.` and log a
  // `MISSING_MESSAGE` per row (G-031b).
  const difficulty = (value: string) =>
    t.has(`difficulty.${value}`) ? t(`difficulty.${value}`) : t("difficulty.unset");
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
          // **A data-only exercise needs no reference solution** and core-api no longer asks for
          // one (DEC-141): there are no automatic tests whose trustworthiness it could prove, and
          // the teacher's "own answer" to "hand in your essay" is an essay. Everything else still
          // applies to it.
          const needsReference = !isDataOnly(exercise.environments);
          const blocked =
            exercise.isLocked ||
            exercise.isBroken ||
            (needsReference && !exercise.hasReferenceSolutions) ||
            !exercise.canAssign;
          return (
            <li
              key={exercise.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{exercise.name || t("untitled")}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{difficulty(exercise.difficulty)}</span>
                  {exercise.environments.length > 0 && (
                    <span>{exercise.environments.join(", ")}</span>
                  )}
                  {exercise.isLocked && <Badge tone="warning">{t("locked")}</Badge>}
                  {exercise.isBroken && <Badge tone="danger">{t("broken")}</Badge>}
                  {needsReference && !exercise.hasReferenceSolutions && (
                    <Badge tone="warning">{t("noReferenceSolution")}</Badge>
                  )}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {/* **The way out of a row that cannot be assigned.** An exercise whose
                    configuration is unfinished is the commonest reason this list refuses one, and
                    until now the reader was told so and left to find the screen that fixes it
                    themselves. Offered on every row rather than only the refused ones -- a
                    finished exercise is also one somebody may want to look at before assigning --
                    and only where core-api's own hint says it would open. */}
                {exercise.canViewConfig && (
                  <Link
                    href={`/exercises/${exercise.id}/edit-config`}
                    className={buttonClasses("outline", "sm")}
                  >
                    {tExercise("configure")}
                  </Link>
                )}
                {blocked ? (
                  <span className="text-xs text-muted-foreground">
                    {exercise.isBroken
                      ? t("cannot.broken")
                      : exercise.isLocked
                        ? t("cannot.locked")
                        : needsReference && !exercise.hasReferenceSolutions
                          ? t("cannot.noReferenceSolution")
                          : t("cannot.notYours")}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={pending !== null}
                    onClick={() => void assign(exercise.id)}
                    className={buttonClasses("primary", "sm")}
                  >
                    {pending === exercise.id ? t("assigning") : t("assign")}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
