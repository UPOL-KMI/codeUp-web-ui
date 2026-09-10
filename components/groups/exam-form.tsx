"use client";

import { FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import { setExamPeriod } from "@/lib/actions/group-exam";
import { examFormToPeriod, type ExamFormValues } from "@/lib/actions/group-exam.schema";
import { toDateTimeLocal } from "@/lib/format/datetime-local";
import { secondsToHoursMinutes } from "@/lib/format/duration";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";
import { EXAM_LOCK_TYPES, type ExamLockType } from "@/lib/status/exam";

import { Dialog, DialogContent } from "@/components/dialog/dialog";

/**
 * Scheduling an exam, and editing one already scheduled (S-008).
 *
 * The two shapes the legacy form offers are both kept, because they answer different questions a
 * teacher actually asks: a beginning is either a time or "now", and an end is either a time or "so
 * many hours from the beginning". Merging them into one absolute pair would make the common case
 * ("two hours, starting now") arithmetic the reader has to do.
 *
 * **Once an exam has begun, only its end can move.** core-api refuses a changed beginning or lock
 * type at that point (`GroupsPresenter::actionSetExamPeriod`), so the form does not offer them --
 * a disabled field with an explanation, rather than a rejected submit.
 */
const DEFAULT_LENGTH = "2:00";
const DEFAULT_LEAD_SECONDS = 2 * 3600;

function defaultValues(
  begin: number | null,
  end: number | null,
  lockType: ExamLockType | null,
): ExamFormValues {
  const now = Math.floor(Date.now() / 1000);
  const suggestedBegin = begin ?? now + DEFAULT_LEAD_SECONDS;
  const suggestedEnd = end ?? suggestedBegin + 2 * 3600;

  return {
    beginImmediately: false,
    begin: toDateTimeLocal(suggestedBegin),
    endRelative: false,
    length: begin && end ? secondsToHoursMinutes(end - begin) : DEFAULT_LENGTH,
    end: toDateTimeLocal(suggestedEnd),
    lockType: lockType ?? "visible",
  };
}

export function ExamFormDialog({
  groupId,
  open,
  onOpenChange,
  onSaved,
  begin,
  end,
  lockType,
  examRunning,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  begin: number | null;
  end: number | null;
  lockType: ExamLockType | null;
  examRunning: boolean;
}) {
  const t = useTranslations("Group.exams.form");
  // The lock names live one level up: the status panel and the previous-exams table name the same
  // four things, and one exam has one name wherever it is written.
  const tExam = useTranslations("Group.exams");
  const { form, onSubmit, isPending } = useServerActionForm<ExamFormValues, { groupId: string }>({
    schema: () => import("@/lib/actions/group-exam.schema").then((module) => module.examFormSchema),
    defaultValues: defaultValues(begin, end, lockType),
    action: (values) => setExamPeriod(groupId, examFormToPeriod(values, examRunning)),
    onSuccess: () => {
      onOpenChange(false);
      onSaved();
    },
  });

  const {
    register,
    watch,
    formState: { errors },
  } = form;
  const beginImmediately = watch("beginImmediately");
  const endRelative = watch("endRelative");

  const fieldError = (key: unknown) => (typeof key === "string" ? t(`errors.${key}`) : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={begin ? t("editTitle") : t("createTitle")}
        description={examRunning ? t("runningDescription") : undefined}
        className="max-w-xl"
      >
        <FormProvider {...form}>
          <form
            onSubmit={(event) => {
              if (isPending) {
                event.preventDefault();
                return;
              }
              void onSubmit(event);
            }}
            className="flex flex-col gap-4"
          >
            <fieldset className="flex flex-col gap-2" disabled={examRunning}>
              <legend className="text-sm font-medium text-foreground">{t("begin")}</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" {...register("beginImmediately")} />
                {t("beginImmediately")}
              </label>
              <input
                type="datetime-local"
                aria-label={t("begin")}
                disabled={beginImmediately || examRunning}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                {...register("begin")}
              />
              {errors.begin?.message && (
                <p role="alert" className="text-sm text-destructive">
                  {fieldError(errors.begin.message)}
                </p>
              )}
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-foreground">{t("end")}</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" {...register("endRelative")} />
                {t("endRelative")}
              </label>
              {endRelative ? (
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={t("length")}
                  placeholder={DEFAULT_LENGTH}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  {...register("length")}
                />
              ) : (
                <input
                  type="datetime-local"
                  aria-label={t("end")}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  {...register("end")}
                />
              )}
              {(errors.end?.message || errors.length?.message) && (
                <p role="alert" className="text-sm text-destructive">
                  {fieldError(errors.end?.message ?? errors.length?.message)}
                </p>
              )}
            </fieldset>

            <fieldset className="flex flex-col gap-2" disabled={examRunning}>
              <legend className="text-sm font-medium text-foreground">{t("lockType")}</legend>
              {EXAM_LOCK_TYPES.map((type) => (
                <label key={type} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    value={type}
                    className="mt-1 size-4"
                    {...register("lockType")}
                  />
                  <span>
                    <span className="font-medium">{tExam(`lockTypes.${type}`)}</span>
                    <span className="block text-muted-foreground">
                      {tExam(`lockHints.${type}`)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            {errors.root?.message && (
              <p role="alert" className="text-sm text-destructive">
                {errors.root.message}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                aria-disabled={isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:opacity-60"
              >
                {isPending ? t("saving") : t("save")}
              </button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
