"use client";

import { useState } from "react";
import { useFieldArray, FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import { updateExerciseTests } from "@/lib/actions/exercise-config";
import { switchFromScoreExpression, switchToScoreExpression } from "@/lib/actions/exercise-score";
import {
  testsSchema,
  TEST_NAME_PATTERN,
  type TestsValues,
} from "@/lib/actions/exercise-config.schema";
import type { ExerciseTest } from "@/lib/exercise-config/types";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
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
 * **All three ways of scoring an exercise are one choice here**, including the custom expression.
 * They used to be two controls on two sections -- a radio for the two averages, and a button
 * further down that switched the whole exercise onto an expression -- which read as two unrelated
 * settings and left a teacher to discover the third possibility by scrolling. The operator asked
 * for one list of three.
 *
 * The two averages are saved with the tests, because a weight belongs to a test by name. The third
 * is not a value this form can save at all: it is a different calculator on core-api's side, so
 * picking it switches the exercise there and then, and picking an average back off it confirms
 * first -- an expression that is not an average cannot be turned into weights, and the equivalent
 * weights of one that is are computed from what is *stored* and carried across so nothing is lost.
 */
export function TestsForm({
  exerciseId,
  tests,
  calculator,
  weights,
  equivalentWeights,
  readOnly,
}: {
  exerciseId: string;
  tests: ExerciseTest[];
  calculator: string;
  weights: Record<string, number>;
  /**
   * What the stored expression would become as weights, or null when it is not an average. Worked
   * out on the server from the configuration core-api holds, not from whatever is currently typed
   * in the editor below -- the text that was never saved is not what leaving would convert.
   */
  equivalentWeights: Record<string, number> | null;
  readOnly: boolean;
}) {
  const t = useTranslations("ExerciseConfig.tests");
  const tScore = useTranslations("ExerciseScore");
  const router = useRouter();
  const toast = useToast();
  const [confirmingRemoval, setConfirmingRemoval] = useState<number | null>(null);
  const [switching, setSwitching] = useState(false);
  const [leavingTo, setLeavingTo] = useState<"uniform" | "weighted" | null>(null);
  const isUniversal = calculator === "universal";

  async function switchTo(option: "uniform" | "weighted" | "universal") {
    setSwitching(true);
    const result =
      option === "universal"
        ? await switchToScoreExpression(exerciseId)
        : await switchFromScoreExpression(exerciseId, option, equivalentWeights ?? {});
    setSwitching(false);
    if (!result.success) {
      toast.error(result.formError ?? tScore("errors.saveFailed"));
      return;
    }
    toast.success(option === "universal" ? tScore("switchIn.done") : tScore("switchOut.done"));
    router.refresh();
  }

  const { form, onSubmit, isPending } = useServerActionForm<TestsValues, { count: number }>({
    schema: testsSchema,
    defaultValues: {
      calculator:
        calculator === "universal" ? "keep" : calculator === "weighted" ? "weighted" : "uniform",
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
    setValue,
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

  /** The three-way choice, rendered the same whichever of them is in force. */
  const calculatorChoice = (chosenOption: string) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{t("calculator")}</legend>
      {(["uniform", "weighted", "universal"] as const).map((option) => (
        <label key={option} className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="calculator-choice"
            value={option}
            checked={chosenOption === option}
            // An expression with no test to refer to is one core-api will not store, so the third
            // option is not offered until there is one -- the rule the switch-in button used to
            // carry, kept where the choice now lives.
            disabled={readOnly || switching || (option === "universal" && tests.length === 0)}
            className="mt-1"
            onChange={() => {
              if (option === chosenOption) return;
              // Only the two averages are this form's to save; the third is a different calculator
              // on core-api's side, and so is leaving it.
              if (option === "universal") {
                void switchTo(option);
              } else if (isUniversal) {
                setLeavingTo(option);
              } else {
                setValue("calculator", option, { shouldDirty: true });
              }
            }}
          />
          <span>
            <span className="font-medium">{t(`calculators.${option}`)}</span>
            <span className="block text-muted-foreground">{t(`calculatorsExplain.${option}`)}</span>
          </span>
        </label>
      ))}
      {tests.length === 0 && (
        <p className="text-xs text-muted-foreground">{tScore("switchIn.noTests")}</p>
      )}
    </fieldset>
  );

  const leavingDialog = (
    <ConfirmDialog
      open={leavingTo !== null}
      onOpenChange={(open) => {
        if (!open) setLeavingTo(null);
      }}
      title={tScore("switchOut.confirm.title")}
      description={
        equivalentWeights
          ? tScore("switchOut.confirm.becomesWeights", {
              weights: Object.entries(equivalentWeights)
                .map(([name, weight]) => `${name} → ${weight}`)
                .join(", "),
            })
          : tScore("switchOut.confirm.lost")
      }
      confirmLabel={tScore("switchOut.confirm.action")}
      pending={switching}
      onConfirm={() => {
        const option = leavingTo ?? "uniform";
        setLeavingTo(null);
        void switchTo(option);
      }}
    />
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {calculatorChoice(isUniversal ? "universal" : chosen)}

        {/* **The tests stay editable whichever way the exercise is scored.** They used to become a
            bullet list the moment an expression was in force, so an exercise could not be given
            another test without first going back to an average -- reported by the operator, who
            hit exactly that. What the expression does *not* tolerate is this form rewriting the
            score configuration underneath it, which is what `keep` prevents. */}
        {isUniversal && (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            {t("universalNotice")}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-md text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="py-1 font-medium">
                  {t("name")}
                </th>
                {!isUniversal && chosen === "weighted" && (
                  <th scope="col" className="w-28 py-1 font-medium">
                    {t("weight")}
                  </th>
                )}
                {!isUniversal && (
                  <th scope="col" className="w-24 py-1 text-center font-medium">
                    {t("share")}
                  </th>
                )}
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
                  {!isUniversal && chosen === "weighted" && (
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
                  {!isUniversal && (
                    <td className="py-1 text-center text-muted-foreground">
                      {share(Number(rows[index]?.weight) || 0)}
                    </td>
                  )}
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
                  // **The names core-api still holds count as taken too**, not just the ones on
                  // screen. A test removed here is gone only once the form is saved, so offering
                  // its name to the next test produced "given test name 'Test 1' is already taken"
                  // from core-api -- which is how the operator found it, after a save that had
                  // failed for an unrelated reason left the two out of step.
                  name: nextTestName([
                    ...rows.map((row) => row.name),
                    ...tests.map((test) => test.name),
                  ]),
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

        {leavingDialog}
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
  for (let index = 1; ; index++) {
    const name = `Test ${index}`;
    if (!used.has(name) && TEST_NAME_PATTERN.test(name)) return name;
  }
}
