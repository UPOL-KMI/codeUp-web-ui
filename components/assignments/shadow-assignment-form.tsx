"use client";

import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import { deleteShadowAssignment, updateShadowAssignment } from "@/lib/actions/shadow-assignment";
import {
  shadowAssignmentSchema,
  type ShadowAssignmentValues,
} from "@/lib/actions/shadow-assignment.schema";
import type { ShadowAssignmentSettings } from "@/lib/api/shadow-assignment";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/format/datetime-local";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { useRouter } from "@/i18n/navigation";
import { MarkdownPreviewTabs } from "@/components/markdown/markdown-preview-tabs";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { FormError } from "@/components/form/form-error";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Everything about a shadow assignment its author decides (G-009).
 *
 * **One form and one save**, because core-api replaces the assignment with what it is sent -- the
 * same shape T-002 found (DEC-092). `version` rides along as the optimistic lock; its `400-010`
 * arrives as core-api's own sentence and is shown rather than retried.
 *
 * The deadline is **informative** and the form says so. That is the whole difference between this
 * and a real assignment: nothing is submitted against it, nothing is enforced by it, and core-api's
 * own documentation says the supervisor decides whether it was breached. Presenting it like a real
 * deadline would promise a countdown that does not exist (DEC-087's reasoning, from the other side).
 */
export function ShadowAssignmentForm({ assignment }: { assignment: ShadowAssignmentSettings }) {
  const t = useTranslations("Shadow.edit");
  const router = useRouter();
  const toast = useToast();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState(
    assignment.deadline === null ? "" : toDateTimeLocal(assignment.deadline),
  );

  const { form, onSubmit, isPending } = useServerActionForm<
    ShadowAssignmentValues,
    { shadowId: string }
  >({
    schema: shadowAssignmentSchema,
    defaultValues: {
      texts: assignment.texts,
      maxPoints: assignment.maxPoints,
      isBonus: assignment.isBonus,
      isPublic: assignment.isPublic,
      deadline: assignment.deadline,
      sendNotification: true,
    },
    action: (values) => updateShadowAssignment(assignment.id, assignment.version, values),
    onSuccess: () => {
      toast.success(t("saved"));
      router.refresh();
    },
  });

  const {
    register,
    setValue,
    formState: { errors },
  } = form;

  const input =
    "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive";

  async function remove() {
    setDeleting(true);
    const result = await deleteShadowAssignment(assignment.id);
    setDeleting(false);
    setConfirmingDelete(false);
    if (result.success) {
      toast.success(t("deleted"));
      router.push(assignment.groupId ? `/groups/${assignment.groupId}?tab=assignments` : "/groups");
    } else {
      toast.error(t("errors.deleteFailed"), result.formError);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <FormProvider {...form}>
        <form
          onSubmit={(event) => {
            if (isPending) {
              event.preventDefault();
              return;
            }
            void onSubmit(event);
          }}
          className="flex flex-col gap-5"
        >
          <FormError />

          {assignment.texts.map((text, index) => (
            <fieldset key={text.locale} className="flex flex-col gap-2">
              <legend className="text-sm font-medium">
                {t("locale", { locale: text.locale })}
              </legend>
              <input type="hidden" {...register(`texts.${index}.locale`)} />

              <div className="flex flex-col gap-1 text-sm">
                <label htmlFor={`shadow-name-${text.locale}`}>{t("name")}</label>
                <input
                  id={`shadow-name-${text.locale}`}
                  type="text"
                  className={input}
                  {...register(`texts.${index}.name`)}
                />
              </div>

              <div className="flex flex-col gap-1 text-sm">
                <label htmlFor={`shadow-text-${text.locale}`}>{t("text")}</label>
                <MarkdownPreviewTabs getSource={() => form.getValues(`texts.${index}.text`) ?? ""}>
                  <textarea
                    id={`shadow-text-${text.locale}`}
                    rows={4}
                    className={`${input} w-full`}
                    {...register(`texts.${index}.text`)}
                  />
                </MarkdownPreviewTabs>
              </div>

              <div className="flex flex-col gap-1 text-sm">
                <label htmlFor={`shadow-link-${text.locale}`}>{t("link")}</label>
                <span
                  id={`shadow-link-${text.locale}-hint`}
                  className="text-xs text-muted-foreground"
                >
                  {t("linkHint")}
                </span>
                <input
                  id={`shadow-link-${text.locale}`}
                  type="url"
                  aria-describedby={`shadow-link-${text.locale}-hint`}
                  aria-invalid={errors.texts?.[index]?.link ? true : undefined}
                  className={input}
                  {...register(`texts.${index}.link`)}
                />
                {errors.texts?.[index]?.link && (
                  <span role="alert" className="text-sm text-destructive">
                    {t("errors.badLink")}
                  </span>
                )}
              </div>
            </fieldset>
          ))}

          {errors.texts?.root && (
            <p role="alert" className="text-sm text-destructive">
              {t("errors.nameRequired")}
            </p>
          )}

          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor="shadow-max-points">{t("maxPoints")}</label>
            <input
              id="shadow-max-points"
              type="number"
              step={1}
              min={0}
              className={`${input} w-32`}
              {...register("maxPoints", { valueAsNumber: true })}
            />
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor="shadow-deadline">{t("deadline")}</label>
            <span id="shadow-deadline-hint" className="text-xs text-muted-foreground">
              {t("deadlineHint")}
            </span>
            <input
              id="shadow-deadline"
              type="datetime-local"
              aria-describedby="shadow-deadline-hint"
              className={`${input} w-64`}
              value={deadlineInput}
              onChange={(event) => {
                setDeadlineInput(event.target.value);
                setValue("deadline", fromDateTimeLocal(event.target.value));
              }}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" {...register("isPublic")} />
            {t("isPublic")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" {...register("isBonus")} />
            {t("isBonus")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" {...register("sendNotification")} />
            {t("sendNotification")}
          </label>

          <div>
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

      {assignment.can.remove === true && (
        <section className="flex flex-col gap-2 border-t border-border pt-6">
          <h2 className="text-sm font-medium text-destructive">{t("delete.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("delete.explain")}</p>
          <div>
            <button
              type="button"
              aria-disabled={deleting}
              className="rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:opacity-60"
              onClick={() => setConfirmingDelete(true)}
            >
              {t("delete.button")}
            </button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={(open) => !open && setConfirmingDelete(false)}
        title={t("delete.confirmTitle")}
        description={t("delete.confirmDescription")}
        pending={deleting}
        onConfirm={() => void remove()}
        confirmLabel={t("delete.confirm")}
      />
    </div>
  );
}
