"use client";

import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import { createInstance } from "@/lib/actions/instances";
import { createInstanceSchema, type CreateInstanceValues } from "@/lib/actions/instances.schema";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { useRouter } from "@/i18n/navigation";
import { MarkdownPreviewTabs } from "@/components/markdown/markdown-preview-tabs";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/dialog/dialog";
import { Field } from "@/components/form/field";
import { FormError } from "@/components/form/form-error";
import { useToast } from "@/components/toast/toast-provider";

/**
 * A new instance (AD-004).
 *
 * **The name and the description are only ever typed here.** core-api builds the instance's root
 * group from them, and the update endpoint accepts nothing but `isOpen` afterwards -- so this is
 * the one screen where they can be set, and changing them later means editing that group. The
 * dialog says as much rather than letting somebody discover it on the settings screen.
 */
export function CreateInstance() {
  const t = useTranslations("Instances.create");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const { form, onSubmit, isPending } = useServerActionForm<CreateInstanceValues, { id: string }>({
    schema: createInstanceSchema,
    defaultValues: { name: "", description: "", isOpen: false },
    action: createInstance,
    onSuccess: (created) => {
      setOpen(false);
      form.reset();
      toast.success(t("created"));
      router.push(`/admin/instances/${created.id}`);
    },
  });

  const {
    register,
    formState: { errors },
  } = form;
  const input =
    "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive";

  function change(next: boolean) {
    setOpen(next);
    if (!next) form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {t("action")}
      </DialogTrigger>

      <DialogContent title={t("title")} description={t("explain")}>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <FormError />

            <Field label={t("name")} error={errors.name && t("errors.tooShort")}>
              <input
                type="text"
                aria-invalid={errors.name ? true : undefined}
                className={input}
                {...register("name")}
              />
            </Field>

            <Field label={t("description")} description={t("descriptionHint")}>
              <MarkdownPreviewTabs getSource={() => form.getValues("description") ?? ""}>
                <textarea rows={3} className={`${input} w-full`} {...register("description")} />
              </MarkdownPreviewTabs>
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" {...register("isOpen")} />
              {t("isOpen")}
            </label>

            <DialogFooter>
              <button
                type="button"
                onClick={() => change(false)}
                className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
              >
                {t("submit")}
              </button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
