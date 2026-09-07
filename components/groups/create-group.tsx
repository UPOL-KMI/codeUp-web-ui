"use client";

import { useState } from "react";
import { FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import { createGroup } from "@/lib/actions/group-create";
import { createGroupSchema, type CreateGroupValues } from "@/lib/actions/group-create.schema";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { useRouter } from "@/i18n/navigation";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/dialog/dialog";
import { FormError } from "@/components/form/form-error";
import { useToast } from "@/components/toast/toast-provider";

/**
 * A new group, or a new subgroup of one (G-008). The same dialog either way: `parentGroupId` is the
 * only difference, and core-api treats its absence as "under this instance's root group".
 *
 * **It asks for the names and nothing else, then leaves on the settings tab.** DEC-093's shape --
 * core-api has no call that creates a group *and* configures it, so the alternative was a wizard
 * holding visibility, the pass rule and the group's kind in the browser until the end, which is a
 * second copy of S-009's form that loses everything if the tab closes. A group created plain harms
 * nobody, and every one of those settings is one click away on the screen this lands on.
 *
 * A name per locale, because core-api looks a group up by name per locale and a group named in one
 * language only is invisible in the other. Blank locales are dropped rather than saved empty.
 */
export function CreateGroup({
  parentGroupId = null,
  locales,
  label,
}: {
  parentGroupId?: string | null;
  locales: readonly string[];
  label: string;
}) {
  const t = useTranslations("Groups.create");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const { form, onSubmit, isPending } = useServerActionForm<CreateGroupValues, { groupId: string }>(
    {
      schema: createGroupSchema,
      defaultValues: {
        texts: locales.map((locale) => ({ locale, name: "", description: "" })),
      },
      action: (values) => createGroup(parentGroupId, values),
      onSuccess: ({ groupId }) => {
        setOpen(false);
        form.reset();
        toast.success(t("created"));
        router.push(`/groups/${groupId}?tab=settings`);
      },
    },
  );

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
        {label}
      </DialogTrigger>

      <DialogContent
        title={parentGroupId === null ? t("title") : t("subgroupTitle")}
        description={t("explain")}
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
            <FormError />

            {locales.map((locale, index) => (
              <div key={locale} className="flex flex-col gap-1 text-sm">
                <label htmlFor={`create-group-name-${locale}`} className="font-medium">
                  {t("name", { locale })}
                </label>
                <input
                  type="text"
                  id={`create-group-name-${locale}`}
                  aria-invalid={errors.texts ? true : undefined}
                  className={input}
                  {...register(`texts.${index}.name`)}
                />
                <input type="hidden" {...register(`texts.${index}.locale`)} />
                <input type="hidden" {...register(`texts.${index}.description`)} />
              </div>
            ))}

            {errors.texts && (
              <p role="alert" className="text-sm text-destructive">
                {t("errors.nameRequired")}
              </p>
            )}

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
                aria-disabled={isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:opacity-60"
              >
                {isPending ? t("submitting") : t("submit")}
              </button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
