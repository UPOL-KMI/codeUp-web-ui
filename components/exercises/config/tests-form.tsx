"use client";

import { useState } from "react";
import { useFieldArray, FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import { updateExerciseTests } from "@/lib/actions/exercise-config";
import {
  testsSchema,
  TEST_NAME_PATTERN,
  type TestsValues,
} from "@/lib/actions/exercise-config.schema";
import type { ExerciseTest } from "@/lib/exercise-config/types";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";

/**
 * The tests an exercise is graded by, and the measure that turns their results into a score
 * (T-009). One form, because core-api's own screen makes them one: a weight belongs to a test by
 * **name**, so a rename and a reweighting have to be saved together or the weight is orphaned.
 *
 * **Renaming a test changes its id.** core-api copies a test rather than updating it and then
 * rewrites the configuration and the limits to point at the copy, so this form's save is followed
 * by a router refresh: the per-test configuration below is bound to ids that no longer exist.
 *
 * **The custom-expression calculator is shown but not edited.** An exercise whose score is a
 * custom expression keeps it -- switching to an average would throw the expression away, and this
 * app has no editor to write one back with (T-025). So the choice is offered only between the two
 * averages, and an exercise already using an expression is told what it has and left alone.
 */
export function TestsForm({
  exerciseId,
  tests,
  calculator,
  weights,
  readOnly,
}: {
  exerciseId: string;
  tests: ExerciseTest[];
  calculator: string;
  weights: Record<string, number>;
  readOnly: boolean;
}) {
  const t = useTranslations("ExerciseConfig.tests");
  const router = useRouter();
  const toast = useToast();
  const [confirmingRemoval, setConfirmingRemoval] = useState<number | null>(null);

  const { form, onSubmit, isPending } = useServerActionForm<TestsValues, { count: number }>({
    schema: testsSchema,
    defaultValues: {
      calculator: calculator === "weighted" ? "weighted" : "uniform",
      tests: tests.map((test) => ({
        id: test.id,
        name: test.name,
        weight: weights[test.name] ?? 100,
      })),
    },
    action: (values) => updateExerciseTests(exerciseId, values),
    onSuccess: () => {
      toast.success(t("saved"));
      router.refresh();
    },
  });

  const {
    control,
    register,
    watch,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "tests" });
  const chosen = watch("calculator");
  const rows = watch("tests");

  const total = rows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);
  const share = (weight: number) =>
    chosen === "weighted"
      ? total > 0
        ? `${Math.round((weight / total) * 1000) / 10} %`
        : "—"
      : rows.length > 0
        ? `${Math.round((100 / rows.length) * 10) / 10} %`
        : "—";

  const input =
    "rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive";

  if (calculator === "universal") {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          {t("universalNotice")}
        </p>
        <ul className="list-disc pl-5 text-sm">
          {tests.map((test) => (
            <li key={test.id}>{test.name}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t("calculator")}</legend>
          {(["uniform", "weighted"] as const).map((option) => (
            <label key={option} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                value={option}
                disabled={readOnly}
                className="mt-1"
                {...register("calculator")}
              />
              <span>
                <span className="font-medium">{t(`calculators.${option}`)}</span>
                <span className="block text-muted-foreground">
                  {t(`calculatorsExplain.${option}`)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="overflow-x-auto">
          <table className="w-full min-w-md text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="py-1 font-medium">
                  {t("name")}
                </th>
                {chosen === "weighted" && (
                  <th scope="col" className="w-28 py-1 font-medium">
                    {t("weight")}
                  </th>
                )}
                <th scope="col" className="w-24 py-1 text-center font-medium">
                  {t("share")}
                </th>
                {!readOnly && <th scope="col" className="w-24 py-1" />}
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id} className="border-b border-border/50">
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      maxLength={64}
                      disabled={readOnly}
                      aria-label={t("name")}
                      aria-invalid={!!errors.tests?.[index]?.name}
                      className={`${input} w-full`}
                      {...register(`tests.${index}.name`)}
                    />
                    {errors.tests?.[index]?.name && (
                      <p role="alert" className="mt-1 text-xs text-destructive">
                        {t("nameInvalid")}
                      </p>
                    )}
                  </td>
                  {chosen === "weighted" && (
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        disabled={readOnly}
                        aria-label={t("weight")}
                        className={`${input} w-24`}
                        {...register(`tests.${index}.weight`, { valueAsNumber: true })}
                      />
                    </td>
                  )}
                  <td className="py-1 text-center text-muted-foreground">
                    {share(Number(rows[index]?.weight) || 0)}
                  </td>
                  {!readOnly && (
                    <td className="py-1 text-right">
                      {confirmingRemoval === index ? (
                        <span className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              remove(index);
                              setConfirmingRemoval(null);
                            }}
                            className="rounded-md border border-destructive px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                          >
                            {t("confirmRemove")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingRemoval(null)}
                            className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
                          >
                            {t("cancel")}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingRemoval(index)}
                          className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
                        >
                          {t("remove")}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {fields.length === 0 && <p className="text-sm text-muted-foreground">{t("noTests")}</p>}

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                append({
                  id: null,
                  name: nextTestName(rows.map((row) => row.name)),
                  weight: 100,
                })
              }
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("add")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {isPending ? t("saving") : t("save")}
            </button>
            <p className="text-xs text-muted-foreground">{t("renameWarning")}</p>
          </div>
        )}

        {errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}
        {errors.tests?.root && (
          <p role="alert" className="text-sm text-destructive">
            {t("duplicateNames")}
          </p>
        )}
      </form>
    </FormProvider>
  );
}

/** `Test 1`, `Test 2`, ... skipping whatever is taken -- core-api refuses two tests of one name. */
function nextTestName(taken: string[]): string {
  const used = new Set(taken.map((name) => name.trim()));
  for (let index = taken.length + 1; ; index++) {
    const name = `Test ${index}`;
    if (!used.has(name) && TEST_NAME_PATTERN.test(name)) return name;
  }
}
