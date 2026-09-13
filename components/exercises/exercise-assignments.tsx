"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { assignExerciseToGroups } from "@/lib/actions/exercise-assign";
import { groupRows } from "@/lib/groups/tree-rows";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * Assigning one exercise to several groups in one go (T-012).
 *
 * The legacy screen's "multi-assign" form, and the reason it is worth keeping: setting up a course
 * with five parallel labs means the same exercise five times, and doing it from each group in turn
 * is five navigations to reach the same button.
 *
 * **Each group succeeds or fails on its own.** core-api has no bulk call, so this is one request
 * per group, and a reader who may create an assignment in four of the five groups they picked gets
 * four assignments and one named refusal -- not an error that hides what did work. Groups that
 * already have an assignment from this exercise are still offered, deliberately: assigning the
 * same exercise twice in one group is legitimate (a practice round and a graded one) and core-api
 * allows it, so the list marks them rather than removing them.
 *
 * **The offer is a tree, not a bag of names.** Only groups that can hold an assignment are
 * selectable -- an organizational one cannot, and core-api refuses it outright -- but on a real
 * department those leaves sit four levels down and their names alone ("2025/26 ZS") say nothing
 * about which course they belong to. So the containers above them are drawn as headings, which is
 * the same shape the group list took when the operator asked the same question of it.
 */
export function AssignToGroups({
  exerciseId,
  groups,
  alreadyAssigned,
}: {
  exerciseId: string;
  /** In tree order, each with the ancestors the reader may see -- see `groupRows`. */
  groups: { id: string; name: string; path: string[] }[];
  alreadyAssigned: Set<string>;
}) {
  const t = useTranslations("ExerciseAssignments.assign");
  const router = useRouter();
  const toast = useToast();
  const [chosen, setChosen] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [refusals, setRefusals] = useState<{ group: string; reason: string }[]>([]);

  async function assign() {
    setPending(true);
    setRefusals([]);
    const result = await assignExerciseToGroups(exerciseId, chosen);
    setPending(false);
    if (!result.success) {
      toast.error(result.formError ?? t("failed"));
      return;
    }

    const created = result.data.filter((outcome) => outcome.assignmentId);
    const failed = result.data.filter((outcome) => outcome.error);
    if (created.length > 0) toast.success(t("assigned", { count: created.length }));
    setRefusals(
      failed.map((outcome) => ({
        group: groups.find((group) => group.id === outcome.groupId)?.name ?? outcome.groupId,
        reason: outcome.error ?? t("failed"),
      })),
    );
    if (failed.length > 0 && created.length === 0) toast.error(t("noneAssigned"));
    setChosen([]);
    router.refresh();
  }

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noGroups")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("explain")}</p>
      <ul className="flex flex-col gap-1">
        {groupRows(groups).map((row) =>
          row.kind === "heading" ? (
            <li
              key={row.key}
              style={{ paddingInlineStart: `${row.depth * 1.25}rem` }}
              className="pt-1 text-xs text-muted-foreground"
            >
              {row.name}
            </li>
          ) : (
            <li key={row.key} style={{ paddingInlineStart: `${row.depth * 1.25}rem` }}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={chosen.includes(row.id)}
                  onChange={(event) =>
                    setChosen((previous) =>
                      event.target.checked
                        ? [...previous, row.id]
                        : previous.filter((id) => id !== row.id),
                    )
                  }
                />
                <span>
                  {row.name}
                  {alreadyAssigned.has(row.id) && (
                    <span className="block text-xs text-muted-foreground">{t("already")}</span>
                  )}
                </span>
              </label>
            </li>
          ),
        )}
      </ul>

      <div>
        <button
          type="button"
          disabled={pending || chosen.length === 0}
          onClick={() => void assign()}
          className={buttonClasses("primary", "sm")}
        >
          {pending ? t("assigning") : t("assign", { count: chosen.length })}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t("invisible")}</p>

      {refusals.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
          {refusals.map((refusal) => (
            <li key={refusal.group}>
              {t("refused", { group: refusal.group, reason: refusal.reason })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
