"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { updateExerciseLimits } from "@/lib/actions/exercise-limits";
import type { LimitsFormValues } from "@/lib/actions/exercise-limits.schema";
import {
  limitsConstraints,
  validateLimits,
  type HardwareGroup,
  type LimitCell,
  type LimitsValues,
} from "@/lib/exercise-config/limits";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";

/**
 * One hardware group's limits (T-010): a cell per test and language, holding how much memory and
 * how much time that test may take.
 *
 * **Not React Hook Form.** Every other form in this app is, and this one is the exception the rule
 * needs: the fields here are a grid whose shape is data -- tests down, languages across, both
 * changing whenever T-009's screen is used -- and the three copy controls each write a whole row,
 * column or grid at once. A `useState` object with a single `setCell` is the shape that
 * expresses that; a resolver over a record of records would validate each cell in isolation and
 * still not catch what actually gets a save refused, which is the **sum** of a column.
 *
 * That sum is why the totals row is not decoration. A hardware group caps how long one test may
 * take *and* how long the whole exercise may, so limits that are fine cell by cell can still be
 * refused -- and the only place a reader can see that coming is a running total per language.
 *
 * Copying is offered three ways because a grid is filled in three ways: the same limit for one
 * test in every language, for one language in every test, or everywhere. The legacy form calls
 * these clone-horizontally, clone-vertically and clone-all; they do the same thing here.
 */
export function LimitsForm({
  exerciseId,
  hardwareGroup,
  exerciseGroups,
  tests,
  environments,
  initial,
  readOnly,
}: {
  exerciseId: string;
  hardwareGroup: HardwareGroup;
  exerciseGroups: HardwareGroup[];
  tests: { id: string; name: string }[];
  environments: { id: string; name: string }[];
  initial: LimitsValues;
  readOnly: boolean;
}) {
  const t = useTranslations("ExerciseLimits.form");
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<LimitsValues>(initial);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const testIds = tests.map((test) => test.id);
  const environmentIds = environments.map((environment) => environment.id);
  const constraints = limitsConstraints(exerciseGroups, values.preciseTime);
  const problems = validateLimits(values, constraints, testIds, environmentIds);

  const problemAt = (testId: string, environmentId: string, kind: "memory" | "time") =>
    problems.some(
      (problem) =>
        problem.kind === kind &&
        problem.testId === testId &&
        problem.environmentId === environmentId,
    );
  const overTotal = (environmentId: string) =>
    problems.some((problem) => problem.kind === "total" && problem.environmentId === environmentId);

  function setCell(testId: string, environmentId: string, cell: Partial<LimitCell>) {
    setValues((previous) => ({
      ...previous,
      cells: {
        ...previous.cells,
        [testId]: {
          ...previous.cells[testId],
          [environmentId]: { ...previous.cells[testId]?.[environmentId], ...cell } as LimitCell,
        },
      },
    }));
  }

  /** Copy one cell across its own row, its own column, or the whole grid. */
  function copy(testId: string, environmentId: string, scope: "row" | "column" | "all") {
    const source = values.cells[testId]?.[environmentId];
    if (!source) return;
    setValues((previous) => {
      const cells = { ...previous.cells };
      for (const test of testIds) {
        if (scope === "row" && test !== testId) continue;
        cells[test] = { ...cells[test] };
        for (const environment of environmentIds) {
          if (scope === "column" && environment !== environmentId) continue;
          cells[test]![environment] = { ...source };
        }
      }
      return { ...previous, cells };
    });
  }

  const columnTotal = (environmentId: string) =>
    testIds.reduce((sum, testId) => {
      const time = Number(values.cells[testId]?.[environmentId]?.time);
      return sum + (Number.isFinite(time) ? time : 0);
    }, 0);

  async function save() {
    setFormError(null);
    setPending(true);
    const payload: LimitsFormValues = {
      hardwareGroupId: hardwareGroup.id,
      preciseTime: values.preciseTime,
      cells: values.cells,
    };
    const result: ActionResult<{ cells: number }> = await updateExerciseLimits(exerciseId, payload);
    setPending(false);
    if (!result.success) {
      setFormError(result.formError ?? t("saveFailed"));
      return;
    }
    toast.success(t("saved"));
    router.refresh();
  }

  const input =
    "w-24 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive";
  const copyButton =
    "rounded border border-input px-1 text-[10px] leading-4 text-muted-foreground hover:bg-muted";

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          aria-label={t("preciseTime")}
          disabled={readOnly}
          checked={values.preciseTime}
          onChange={(event) =>
            setValues((previous) => ({ ...previous, preciseTime: event.target.checked }))
          }
        />
        <span>
          {t("preciseTime")}
          <span className="block text-xs text-muted-foreground">{t("preciseTimeExplain")}</span>
        </span>
      </label>

      <p className="text-xs text-muted-foreground">
        {t("ceilings", {
          memory: constraints.memory.max,
          time: constraints.time.max,
          total: constraints.totalTime.max,
        })}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium">
                {t("test")}
              </th>
              {environments.map((environment) => (
                <th key={environment.id} scope="col" className="py-1 pr-3 font-medium">
                  {environment.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tests.map((test) => (
              <tr key={test.id} className="border-b border-border/50 align-top">
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  {test.name}
                </th>
                {environments.map((environment) => {
                  const cell = values.cells[test.id]?.[environment.id];
                  return (
                    <td key={environment.id} className="py-2 pr-3">
                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-1 text-xs">
                          <span className="w-14 text-muted-foreground">{t("memory")}</span>
                          <input
                            type="number"
                            min={0}
                            step={128}
                            className={input}
                            aria-label={t("memoryOf", {
                              test: test.name,
                              environment: environment.name,
                            })}
                            aria-invalid={problemAt(test.id, environment.id, "memory")}
                            disabled={readOnly}
                            value={cell?.memory ?? ""}
                            onChange={(event) =>
                              setCell(test.id, environment.id, { memory: event.target.value })
                            }
                          />
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <span className="w-14 text-muted-foreground">{t("time")}</span>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            className={input}
                            aria-label={t("timeOf", {
                              test: test.name,
                              environment: environment.name,
                            })}
                            aria-invalid={problemAt(test.id, environment.id, "time")}
                            disabled={readOnly}
                            value={cell?.time ?? ""}
                            onChange={(event) =>
                              setCell(test.id, environment.id, { time: event.target.value })
                            }
                          />
                        </label>
                        {!readOnly && environments.length + tests.length > 2 && (
                          <span className="flex gap-1">
                            {environments.length > 1 && (
                              <button
                                type="button"
                                className={copyButton}
                                aria-label={t("copyRowOf", {
                                  test: test.name,
                                  environment: environment.name,
                                })}
                                title={t("copyRow")}
                                onClick={() => copy(test.id, environment.id, "row")}
                              >
                                {t("copyRowShort")}
                              </button>
                            )}
                            {tests.length > 1 && (
                              <button
                                type="button"
                                className={copyButton}
                                aria-label={t("copyColumnOf", {
                                  test: test.name,
                                  environment: environment.name,
                                })}
                                title={t("copyColumn")}
                                onClick={() => copy(test.id, environment.id, "column")}
                              >
                                {t("copyColumnShort")}
                              </button>
                            )}
                            {environments.length > 1 && tests.length > 1 && (
                              <button
                                type="button"
                                className={copyButton}
                                aria-label={t("copyAllOf", {
                                  test: test.name,
                                  environment: environment.name,
                                })}
                                title={t("copyAll")}
                                onClick={() => copy(test.id, environment.id, "all")}
                              >
                                {t("copyAllShort")}
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                className="py-2 pr-3 text-left text-xs font-normal text-muted-foreground"
              >
                {t("totalTime")}
              </th>
              {environments.map((environment) => (
                <td
                  key={environment.id}
                  className={`py-2 pr-3 text-xs ${
                    overTotal(environment.id) ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {t("totalTimeValue", {
                    total: Math.round(columnTotal(environment.id) * 10) / 10,
                    max: constraints.totalTime.max,
                  })}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {problems.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("outOfRange")}
        </p>
      )}
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      {!readOnly && (
        <div>
          <button
            type="button"
            disabled={pending || problems.length > 0}
            onClick={() => void save()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {pending ? t("saving") : t("save")}
          </button>
        </div>
      )}
    </div>
  );
}
