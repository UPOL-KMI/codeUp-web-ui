"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  deleteReferenceSolution,
  resubmitAllReferenceSolutions,
  resubmitReferenceSolution,
  setReferenceSolutionVisibility,
} from "@/lib/actions/reference-solutions";
import type { ReferenceSolutionRow } from "@/lib/api/reference-solutions";
import {
  VISIBILITY_PRIVATE,
  VISIBILITY_PROMOTED,
  VISIBILITY_PUBLIC,
} from "@/lib/status/reference-visibility";
import type { ActionResult } from "@/lib/forms/action-result";
import { EVALUATION_TONE, evaluationStatus } from "@/lib/status/evaluation";

import { Link, useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { Badge } from "@/components/status/badge";
import { useToast } from "@/components/toast/toast-provider";

/**
 * The exercise's reference solutions, and what can be done to them (T-011).
 *
 * **Re-evaluating is the point of the screen.** A reference solution is the proof that an
 * exercise's configuration works, and the proof goes stale the moment the configuration changes --
 * new tests, different limits, a different judge. "Re-evaluate all" after editing the
 * configuration is how an author finds out whether they have just broken their own exercise, and
 * it is one call rather than one per solution.
 *
 * **Deleting the last one makes the exercise unassignable**, because core-api refuses to assign an
 * exercise with no reference solution -- a refusal that appears in no list payload, which is how
 * T-001's picker came to meet it only on the attempt. The confirmation says so when it applies.
 *
 * Visibility is a scale rather than a switch: private, visible to students, or *promoted* to the
 * exercise's canonical answer. Each level is named, because "students can read this" and "this is
 * the answer" are different claims and reducing them to a checkbox loses the second.
 *
 * **An empty list does not mean the exercise has none.** core-api filters this list one solution
 * at a time, so a colleague's private answers are simply absent from it -- found live, and the
 * reason the empty state is two different sentences: the exercise's own `hasReferenceSolutions`
 * flag is what tells "nobody has written one" from "none of them is yours to read".
 */
export function ReferenceSolutionsTable({
  exerciseId,
  solutions,
  canResubmitAll,
  someAreHidden,
}: {
  exerciseId: string;
  solutions: ReferenceSolutionRow[];
  canResubmitAll: boolean;
  /** The exercise has reference solutions, but none this reader may see. */
  someAreHidden: boolean;
}) {
  const t = useTranslations("ReferenceSolutions.list");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<ReferenceSolutionRow | null>(null);

  async function run(call: () => Promise<ActionResult<unknown>>, successKey: string) {
    setPending(true);
    const result = await call();
    setPending(false);
    if (!result.success) {
      toast.error(result.formError ?? t("failed"));
      return;
    }
    toast.success(t(successKey));
    router.refresh();
  }

  const input =
    "rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring";

  // An empty list does **not** mean the exercise has none: core-api filters this list per
  // solution, so another author's private answers are simply absent. Saying "this exercise has no
  // reference solution, so it cannot be assigned" to somebody looking at an assignable exercise
  // would be a plain falsehood -- the exercise's own flag is what distinguishes the two.
  if (solutions.length === 0) {
    return someAreHidden ? (
      <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">{t("allHidden")}</p>
    ) : (
      <p className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">{t("none")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {canResubmitAll && (
        <div>
          <button
            type="button"
            disabled={pending}
            onClick={() => void run(() => resubmitAllReferenceSolutions(exerciseId), "resubmitted")}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("resubmitAll")}
          </button>
          <p className="mt-1 text-xs text-muted-foreground">{t("resubmitAllExplain")}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium">
                {t("description")}
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                {t("language")}
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                {t("author")}
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                {t("result")}
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                {t("visibility")}
              </th>
              <th scope="col" className="py-1 font-medium" />
            </tr>
          </thead>
          <tbody>
            {solutions.map((solution) => {
              const status = evaluationStatus({
                lastSubmission: solution.lastSubmission,
                // A reference solution carries no points; only whether it passed matters, so the
                // maximum is nominal and exists to keep `evaluationStatus` on its scoring branch.
                maxPoints: 1,
              });
              return (
                <tr key={solution.id} className="border-b border-border/50 align-top">
                  <td className="py-2 pr-3">
                    <Link
                      href={`/exercises/${exerciseId}/reference-solutions/${solution.id}`}
                      className="text-primary underline underline-offset-2"
                    >
                      {solution.description || t("untitled")}
                    </Link>
                    {solution.submissionCount > 1 && (
                      <span className="block text-xs text-muted-foreground">
                        {t("attempts", { count: solution.submissionCount })}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{solution.environmentName}</td>
                  <td className="py-2 pr-3">{solution.authorName || "—"}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={EVALUATION_TONE[status]}>{t(`status.${status}`)}</Badge>
                  </td>
                  <td className="py-2 pr-3">
                    {solution.can.setVisibility === true ? (
                      <select
                        className={input}
                        aria-label={t("visibilityOf", {
                          description: solution.description || t("untitled"),
                        })}
                        disabled={pending}
                        value={String(solution.visibility)}
                        onChange={(event) =>
                          void run(
                            () =>
                              setReferenceSolutionVisibility(
                                solution.id,
                                Number(event.target.value),
                              ),
                            "visibilityChanged",
                          )
                        }
                      >
                        <option value={String(VISIBILITY_PRIVATE)}>{t("levels.private")}</option>
                        <option value={String(VISIBILITY_PUBLIC)}>{t("levels.public")}</option>
                        <option value={String(VISIBILITY_PROMOTED)}>{t("levels.promoted")}</option>
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {solution.visibility >= VISIBILITY_PROMOTED
                          ? t("levels.promoted")
                          : solution.visibility >= VISIBILITY_PUBLIC
                            ? t("levels.public")
                            : t("levels.private")}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <span className="flex justify-end gap-1">
                      {solution.can.evaluate === true && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            void run(
                              () => resubmitReferenceSolution(solution.id, false),
                              "resubmitted",
                            )
                          }
                          className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                        >
                          {t("resubmit")}
                        </button>
                      )}
                      {solution.can.delete === true && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setDeleting(solution)}
                          className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                        >
                          {t("delete")}
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("confirmDelete.title")}
        description={
          solutions.length === 1
            ? t("confirmDelete.lastOne")
            : t("confirmDelete.description", {
                description: deleting?.description || t("untitled"),
              })
        }
        confirmLabel={t("confirmDelete.confirm")}
        pending={pending}
        onConfirm={() => {
          const solution = deleting;
          setDeleting(null);
          if (solution) void run(() => deleteReferenceSolution(solution.id), "deleted");
        }}
      />
    </div>
  );
}
