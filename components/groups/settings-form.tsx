"use client";

import { useId } from "react";
import { FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import { updateGroupSettings } from "@/lib/actions/group-settings";
import {
  groupSettingsSchema,
  PASS_MODES,
  type GroupSettingsValues,
} from "@/lib/actions/group-settings.schema";
import type { GroupDetail } from "@/lib/api/group-detail";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { useRouter } from "@/i18n/navigation";
import { MarkdownPreviewTabs } from "@/components/markdown/markdown-preview-tabs";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * A group's own settings (S-009): what it is called in each language, who may see it, and what it
 * takes to pass it.
 *
 * **Every locale is edited at once, and every locale is submitted at once**, because core-api
 * replaces the whole `localizedTexts` array with what it is sent -- a form that edited only the
 * reader's own language would silently delete the other one. The locales offered are the app's
 * own (`routing.locales`, passed in), plus any extra locale the group already carries, so a text
 * written by the legacy app in a third language is not dropped by opening this form.
 *
 * A blank name is how a language is *removed*, not an error: most seeded groups are named in one
 * language only, and demanding a Czech name before an English one can be saved would be this form
 * inventing a rule core-api does not have. At least one name has to survive.
 *
 * Passing a group is a percentage *or* an absolute number of points, never both (core-api's own
 * rule, `setGroupPoints`), so the two are one three-way choice here rather than two fields that
 * can contradict each other.
 */
export function GroupSettingsForm({
  group,
  locales,
}: {
  group: GroupDetail;
  locales: readonly string[];
}) {
  const t = useTranslations("Group.settings.form");
  const router = useRouter();
  const toast = useToast();
  const passingErrorId = useId();

  const editedLocales = [
    ...locales,
    ...group.texts.map((text) => text.locale).filter((locale) => !locales.includes(locale)),
  ];

  const { form, onSubmit, isPending } = useServerActionForm<
    GroupSettingsValues,
    { groupId: string }
  >({
    schema: groupSettingsSchema,
    defaultValues: {
      texts: editedLocales.map((locale) => {
        const existing = group.texts.find((text) => text.locale === locale);
        return { locale, name: existing?.name ?? "", description: existing?.description ?? "" };
      }),
      externalId: group.externalId,
      isPublic: group.public,
      publicStats: group.publicStats,
      detaining: group.detaining,
      // **Zero is "nothing required", not "require zero".** core-api stores an unset threshold as
      // `0` rather than as null, and reading that as "percentage mode, value 0" put the form into
      // a state it then refused to save: the field showed 0, the browser's own `min` complained,
      // and the schema wanted at least 1. Reported from the settings screen of a freshly created
      // group, where 0 is what every group starts with.
      passMode:
        group.threshold !== null && group.threshold > 0
          ? "threshold"
          : group.pointsLimit !== null && group.pointsLimit > 0
            ? "pointsLimit"
            : "none",
      threshold:
        group.threshold !== null && group.threshold > 0 ? Math.round(group.threshold * 100) : null,
      pointsLimit: group.pointsLimit !== null && group.pointsLimit > 0 ? group.pointsLimit : null,
    },
    action: (values) => updateGroupSettings(group.id, values),
    onSuccess: () => {
      toast.success(t("saved"));
      router.refresh();
    },
  });

  const {
    register,
    watch,
    formState: { errors },
  } = form;
  const passMode = watch("passMode");

  const input =
    "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive";

  return (
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
        {editedLocales.map((locale, index) => (
          <fieldset key={locale} className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t("locale", { locale })}</legend>
            <input type="hidden" {...register(`texts.${index}.locale`)} />
            <label className="flex flex-col gap-1 text-sm">
              {t("name")}
              <input type="text" className={input} {...register(`texts.${index}.name`)} />
            </label>
            <div className="flex flex-col gap-1 text-sm">
              <label htmlFor={`group-description-${index}`}>{t("description")}</label>
              <MarkdownPreviewTabs
                getSource={() => form.getValues(`texts.${index}.description`) ?? ""}
              >
                <textarea
                  id={`group-description-${index}`}
                  rows={3}
                  className={`${input} w-full`}
                  {...register(`texts.${index}.description`)}
                />
              </MarkdownPreviewTabs>
            </div>
          </fieldset>
        ))}

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="externalId">{t("externalId")}</label>
          <input
            type="text"
            id="externalId"
            aria-describedby="externalId-hint"
            className={input}
            {...register("externalId")}
          />
          <span id="externalId-hint" className="text-xs text-muted-foreground">
            {t("externalIdHint")}
          </span>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4" {...register("isPublic")} />
            {t("isPublic")}
          </label>
          {/* Both are about students, and an organizational group cannot have any -- core-api
              refuses them. The settings tab itself stays: it is where the organizational flag is
              turned off again. */}
          {!group.organizational && (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4" {...register("publicStats")} />
                {t("publicStats")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4" {...register("detaining")} />
                {t("detaining")}
              </label>
            </>
          )}
        </div>

        {/* Same reason as the two checkboxes above: a group with no assignments awards no points,
            so there is nothing for a threshold to be a threshold of. */}
        {!group.organizational && (
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="text-sm font-medium">{t("passing")}</legend>
            {PASS_MODES.map((mode) => (
              <label key={mode} className="flex items-center gap-2">
                <input type="radio" value={mode} className="size-4" {...register("passMode")} />
                {t(`passModes.${mode}`)}
              </label>
            ))}
            {passMode === "threshold" && (
              <label className="flex items-center gap-2">
                {t("threshold")}
                <input
                  type="number"
                  min={1}
                  max={100}
                  aria-invalid={errors.threshold ? true : undefined}
                  aria-describedby={errors.threshold ? passingErrorId : undefined}
                  className={`${input} w-24`}
                  {...register("threshold", {
                    setValueAs: (value) => (value === "" ? null : Number(value)),
                  })}
                />
              </label>
            )}
            {passMode === "pointsLimit" && (
              <label className="flex items-center gap-2">
                {t("pointsLimit")}
                <input
                  type="number"
                  min={1}
                  aria-invalid={errors.pointsLimit ? true : undefined}
                  aria-describedby={errors.pointsLimit ? passingErrorId : undefined}
                  className={`${input} w-24`}
                  {...register("pointsLimit", {
                    setValueAs: (value) => (value === "" ? null : Number(value)),
                  })}
                />
              </label>
            )}
            {(errors.threshold || errors.pointsLimit) && (
              <p id={passingErrorId} role="alert" className="text-sm text-destructive">
                {t("errors.limitRequired")}
              </p>
            )}
          </fieldset>
        )}

        {errors.texts && (
          <p role="alert" className="text-sm text-destructive">
            {t("errors.nameRequired")}
          </p>
        )}

        {errors.root?.message && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}

        <div>
          <button
            type="submit"
            aria-disabled={isPending}
            className={buttonClasses("primary", "sm")}
          >
            {isPending ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
