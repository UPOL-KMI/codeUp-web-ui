"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { updateAssignment } from "@/lib/actions/assignment";
import type { AssignmentSettingsValues } from "@/lib/actions/assignment.schema";
import type { AssignmentSettings } from "@/lib/api/assignment-edit";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/format/datetime-local";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Everything about an assignment that its author decides (T-002): when it is due, what it is
 * worth, how many times it may be attempted, and how much of the evaluation a student is shown.
 *
 * One submit, not S-022's four, because **core-api replaces the assignment with what it is sent**:
 * there is no partial update, so every save carries every field regardless, and splitting the form
 * would only hide that. `version` rides along as the optimistic lock -- when someone else saved
 * first, core-api's own message says so and the page reloads rather than overwriting them.
 *
 * Hand-rolled rather than `useServerActionForm`, for the same reason S-009's settings form is: the
 * shape here is a dozen checkboxes and two conditional groups, and RHF's `register` buys little
 * over one draft object when almost nothing is a free-text field with its own error.
 */
const inputClass =
  "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

/**
 * The hint is a **description, not part of the name**. Wrapping it inside the `<label>` -- which is
 * what the shorter version of this does -- makes a screen reader announce the field as "Attempts
 * allowed How many times one student may submit", and makes the label impossible to match exactly.
 * Found by this ticket's own spec; `components/form/text-field.tsx` already had it right.
 */
function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

function NumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number | null;
  min?: number;
  max?: number;
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label} hint={hint}>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={inputClass}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function DateTimeField({
  id,
  label,
  hint,
  value,
  required,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label} hint={hint}>
      <input
        id={id}
        type="datetime-local"
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4"
        aria-describedby={hint ? `${id}-hint` : undefined}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="flex flex-col gap-0.5">
        <label htmlFor={id}>{label}</label>
        {hint && (
          <span id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * The three dates stay wall-clock strings while they are being edited and become unix seconds on
 * the way to the action, because that conversion has to happen in the reader's own zone
 * (`lib/format/datetime-local.ts`).
 */
type DraftValues = Omit<
  AssignmentSettingsValues,
  "visibleFrom" | "firstDeadline" | "secondDeadline"
> & {
  visibleFrom: string;
  firstDeadline: string;
  secondDeadline: string;
};

export function AssignmentForm({ assignment }: { assignment: AssignmentSettings }) {
  const t = useTranslations("AssignmentEdit");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftValues>({
    isPublic: assignment.isPublic,
    isBonus: assignment.isBonus,
    isExam: assignment.isExam,
    visibleFrom: assignment.visibleFrom === null ? "" : toDateTimeLocal(assignment.visibleFrom),
    firstDeadline: toDateTimeLocal(assignment.firstDeadline),
    maxPointsFirst: assignment.maxPointsFirst,
    allowSecondDeadline: assignment.allowSecondDeadline,
    secondDeadline:
      assignment.secondDeadline === null ? "" : toDateTimeLocal(assignment.secondDeadline),
    maxPointsSecond: assignment.maxPointsSecond,
    interpolatePoints: assignment.interpolatePoints,
    pointsThreshold: assignment.pointsThreshold,
    submissionsCountLimit: assignment.submissionsCountLimit,
    solutionFilesLimit: assignment.solutionFilesLimit,
    solutionSizeLimit: assignment.solutionSizeLimit,
    disabledEnvironments: assignment.disabledEnvironments,
    canViewLimitRatios: assignment.canViewLimitRatios,
    canViewMeasuredValues: assignment.canViewMeasuredValues,
    canViewJudgeStdout: assignment.canViewJudgeStdout,
    canViewJudgeStderr: assignment.canViewJudgeStderr,
    hints: assignment.hints,
    // Only ever true for the save that first makes an assignment public -- core-api ignores it
    // otherwise, and defaulting it on would mail a class every time a typo is corrected.
    sendNotification: false,
  });

  const set = <K extends keyof DraftValues>(key: K, value: DraftValues[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const becomingPublic = draft.isPublic && !assignment.isPublic;

  async function save() {
    setPending(true);
    setError(null);
    const values: AssignmentSettingsValues = {
      ...draft,
      visibleFrom: fromDateTimeLocal(draft.visibleFrom),
      firstDeadline: fromDateTimeLocal(draft.firstDeadline),
      secondDeadline: fromDateTimeLocal(draft.secondDeadline),
    };
    const result: ActionResult<unknown> = await updateAssignment(
      assignment.id,
      assignment.version,
      values,
    );
    setPending(false);
    if (result.success) {
      toast.success(t("saved"));
      router.push(`/assignments/${assignment.id}`);
      return;
    }
    setError(result.formError ?? t("errors.updateFailed"));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex flex-col gap-10"
    >
      <section aria-labelledby="assignment-visibility" className="flex flex-col gap-3">
        <h2 id="assignment-visibility" className="text-base font-semibold tracking-tight">
          {t("visibility.title")}
        </h2>
        <Toggle
          id="assignment-is-public"
          label={t("visibility.isPublic")}
          hint={t("visibility.isPublicHint")}
          checked={draft.isPublic}
          onChange={(value) => set("isPublic", value)}
        />
        <DateTimeField
          id="assignment-visible-from"
          label={t("visibility.visibleFrom")}
          hint={t("visibility.visibleFromHint")}
          value={draft.visibleFrom}
          onChange={(value) => set("visibleFrom", value)}
        />
        <Toggle
          id="assignment-is-bonus"
          label={t("visibility.isBonus")}
          hint={t("visibility.isBonusHint")}
          checked={draft.isBonus}
          onChange={(value) => set("isBonus", value)}
        />
        <Toggle
          id="assignment-is-exam"
          label={t("visibility.isExam")}
          hint={t("visibility.isExamHint")}
          checked={draft.isExam}
          onChange={(value) => set("isExam", value)}
        />
        {becomingPublic && (
          <Toggle
            id="assignment-send-notification"
            label={t("visibility.sendNotification")}
            hint={t("visibility.sendNotificationHint")}
            checked={draft.sendNotification}
            onChange={(value) => set("sendNotification", value)}
          />
        )}
      </section>

      <section aria-labelledby="assignment-deadlines" className="flex flex-col gap-3">
        <h2 id="assignment-deadlines" className="text-base font-semibold tracking-tight">
          {t("deadlines.title")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <DateTimeField
            id="assignment-first-deadline"
            label={t("deadlines.first")}
            required
            value={draft.firstDeadline}
            onChange={(value) => set("firstDeadline", value)}
          />
          <NumberField
            id="assignment-max-points-first"
            label={t("deadlines.maxPointsFirst")}
            min={0}
            value={draft.maxPointsFirst}
            onChange={(value) => set("maxPointsFirst", Number(value))}
          />
        </div>

        <Toggle
          id="assignment-allow-second"
          label={t("deadlines.allowSecond")}
          hint={t("deadlines.allowSecondHint")}
          checked={draft.allowSecondDeadline}
          onChange={(value) => set("allowSecondDeadline", value)}
        />
        {draft.allowSecondDeadline && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <DateTimeField
                id="assignment-second-deadline"
                label={t("deadlines.second")}
                value={draft.secondDeadline}
                onChange={(value) => set("secondDeadline", value)}
              />
              <NumberField
                id="assignment-max-points-second"
                label={t("deadlines.maxPointsSecond")}
                min={0}
                value={draft.maxPointsSecond}
                onChange={(value) => set("maxPointsSecond", Number(value))}
              />
            </div>
            <Toggle
              id="assignment-interpolate"
              label={t("deadlines.interpolate")}
              hint={t("deadlines.interpolateHint")}
              checked={draft.interpolatePoints}
              onChange={(value) => set("interpolatePoints", value)}
            />
          </>
        )}
      </section>

      <section aria-labelledby="assignment-limits" className="flex flex-col gap-3">
        <h2 id="assignment-limits" className="text-base font-semibold tracking-tight">
          {t("limits.title")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            id="assignment-attempts"
            label={t("limits.attempts")}
            hint={t("limits.attemptsHint")}
            min={1}
            value={draft.submissionsCountLimit}
            onChange={(value) => set("submissionsCountLimit", Number(value))}
          />
          <NumberField
            id="assignment-threshold"
            label={t("limits.threshold")}
            hint={t("limits.thresholdHint")}
            min={0}
            max={100}
            value={draft.pointsThreshold}
            onChange={(value) => set("pointsThreshold", Number(value))}
          />
          <NumberField
            id="assignment-files-limit"
            label={t("limits.files")}
            hint={t("limits.unlimitedHint")}
            min={1}
            value={draft.solutionFilesLimit}
            onChange={(value) => set("solutionFilesLimit", value === "" ? null : Number(value))}
          />
          <NumberField
            id="assignment-size-limit"
            label={t("limits.size")}
            hint={t("limits.unlimitedHint")}
            min={1}
            value={draft.solutionSizeLimit}
            onChange={(value) => set("solutionSizeLimit", value === "" ? null : Number(value))}
          />
        </div>

        {assignment.environments.length > 1 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t("limits.environments")}</legend>
            <p className="text-xs text-muted-foreground">{t("limits.environmentsHint")}</p>
            {assignment.environments.map((environment) => (
              <label key={environment} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={!draft.disabledEnvironments.includes(environment)}
                  onChange={(event) =>
                    set(
                      "disabledEnvironments",
                      event.target.checked
                        ? draft.disabledEnvironments.filter((id) => id !== environment)
                        : [...draft.disabledEnvironments, environment],
                    )
                  }
                />
                {environment}
              </label>
            ))}
          </fieldset>
        )}
      </section>

      <section aria-labelledby="assignment-disclosure" className="flex flex-col gap-3">
        <h2 id="assignment-disclosure" className="text-base font-semibold tracking-tight">
          {t("disclosure.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("disclosure.explain")}</p>
        <Toggle
          id="assignment-limit-ratios"
          label={t("disclosure.limitRatios")}
          checked={draft.canViewLimitRatios}
          onChange={(value) => set("canViewLimitRatios", value)}
        />
        <Toggle
          id="assignment-measured-values"
          label={t("disclosure.measuredValues")}
          checked={draft.canViewMeasuredValues}
          onChange={(value) => set("canViewMeasuredValues", value)}
        />
        <Toggle
          id="assignment-judge-stdout"
          label={t("disclosure.judgeStdout")}
          checked={draft.canViewJudgeStdout}
          onChange={(value) => set("canViewJudgeStdout", value)}
        />
        <Toggle
          id="assignment-judge-stderr"
          label={t("disclosure.judgeStderr")}
          checked={draft.canViewJudgeStderr}
          onChange={(value) => set("canViewJudgeStderr", value)}
        />
      </section>

      <section aria-labelledby="assignment-hints" className="flex flex-col gap-3">
        <h2 id="assignment-hints" className="text-base font-semibold tracking-tight">
          {t("hints.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("hints.explain")}</p>
        {draft.hints.map((hint, index) => (
          <Field
            key={hint.locale}
            id={`assignment-hint-${hint.locale}`}
            label={t.has(`language.${hint.locale}`) ? t(`language.${hint.locale}`) : hint.locale}
          >
            <textarea
              id={`assignment-hint-${hint.locale}`}
              rows={2}
              className={inputClass}
              value={hint.hint}
              onChange={(event) =>
                set(
                  "hints",
                  draft.hints.map((current, position) =>
                    position === index ? { ...current, hint: event.target.value } : current,
                  ),
                )
              }
            />
          </Field>
        ))}
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          {pending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
