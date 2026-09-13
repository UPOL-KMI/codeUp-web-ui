"use client";

import { FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import { updateExerciseEnvironments } from "@/lib/actions/exercise-config";
import { environmentsSchema, type EnvironmentsValues } from "@/lib/actions/exercise-config.schema";
import { isStandaloneEnvironment } from "@/lib/exercise-config/environments";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * Which languages an exercise accepts (T-009).
 *
 * The form is only a set of checkboxes because that is all this choice is: the *contents* of an
 * environment's configuration -- the glob of what a student may submit -- comes from the
 * instance's own defaults for that language and is not edited here, exactly as in the legacy
 * simple form. Editing it by hand is part of the advanced configuration (T-024).
 *
 * **Some environments cannot share an exercise with another.** That rule is the editor's, not
 * core-api's: it will happily store the combination, and the configuration it produces is one no
 * pipeline can run. It is checked here before saving rather than reported afterwards.
 *
 * Saving rewrites the configuration below -- core-api adds and removes whole environment branches
 * of it -- so this, like the tests form, refreshes the page rather than leaving stale ids bound.
 */
export function EnvironmentsForm({
  exerciseId,
  available,
  selected,
  readOnly,
}: {
  exerciseId: string;
  available: { id: string; name: string; longName: string; description: string }[];
  selected: string[];
  readOnly: boolean;
}) {
  const t = useTranslations("ExerciseConfig.environments");
  const router = useRouter();
  const toast = useToast();

  const { form, onSubmit, isPending } = useServerActionForm<EnvironmentsValues, { count: number }>({
    schema: environmentsSchema,
    defaultValues: { environments: selected },
    action: (values) => updateExerciseEnvironments(exerciseId, values),
    onSuccess: () => {
      toast.success(t("saved"));
      router.refresh();
    },
  });

  const {
    register,
    watch,
    setError,
    formState: { errors },
  } = form;
  const chosen = watch("environments") ?? [];

  const exclusive = chosen.filter(isStandaloneEnvironment);
  const conflict = chosen.length > 1 && exclusive.length > 0;

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => {
          if (conflict) {
            event.preventDefault();
            setError("root", {
              message: t("exclusiveConflict", {
                environments: exclusive
                  .map((id) => available.find((entry) => entry.id === id)?.name ?? id)
                  .join(", "),
              }),
            });
            return;
          }
          void onSubmit(event);
        }}
        className="flex flex-col gap-4"
      >
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((environment) => (
            <li key={environment.id}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  value={environment.id}
                  disabled={readOnly}
                  className="mt-1"
                  {...register("environments")}
                />
                <span>
                  <span className="font-medium">{environment.longName}</span>
                  {isStandaloneEnvironment(environment.id) && (
                    <span className="ml-1 text-xs text-warning">{t("exclusive")}</span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {environment.description}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {chosen.length === 0 && <p className="text-sm text-warning">{t("noneSelected")}</p>}

        {!readOnly && (
          <div className="flex items-center gap-2">
            <button type="submit" disabled={isPending} className={buttonClasses("primary", "sm")}>
              {isPending ? t("saving") : t("save")}
            </button>
            <p className="text-xs text-muted-foreground">{t("saveWarning")}</p>
          </div>
        )}

        {errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}
      </form>
    </FormProvider>
  );
}
