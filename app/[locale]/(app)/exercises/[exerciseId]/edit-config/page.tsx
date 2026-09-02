import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getExerciseConfigData } from "@/lib/api/exercise-config";
import { getExerciseDetail } from "@/lib/api/exercise-detail";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { describeValidationError } from "@/lib/status/exercise-validation";
import { configCapabilities, readSimpleConfig } from "@/lib/exercise-config/simple-config";

import { Link } from "@/i18n/navigation";
import { EnvironmentsForm } from "@/components/exercises/config/environments-form";
import { TestConfigForm } from "@/components/exercises/config/test-config-form";
import { TestsForm } from "@/components/exercises/config/tests-form";
import { PageShell } from "@/components/page-shell";

/**
 * An exercise's evaluation configuration (T-009) -- the legacy `/app/exercises/:id/edit-config`
 * route, and the screen that turns a newly created exercise from broken into assignable.
 *
 * Three forms, in the order the answers depend on each other. **The tests come first** because a
 * configuration is a value per test, and there is nothing to configure until at least one exists.
 * **The environments come second** because the fields each test offers are read off the pipelines
 * of the languages chosen. **The configuration itself comes last**, and is not rendered at all
 * without both -- which is what the legacy screen does, and better than a form whose every select
 * is empty for a reason it does not explain.
 *
 * The reasons core-api calls the exercise broken are repeated at the top. They are the same list
 * T-021 shows, and this is the screen that answers most of them, so putting them next to the forms
 * that fix them is the point rather than duplication.
 *
 * **Only the simple configuration is edited here.** An exercise whose configuration was built out
 * of hand-picked pipelines (`advancedExerciseConfig`) is left alone and says so: rewriting it
 * through this form would replace those pipelines with the instance's default ones, which is a
 * silent, unrecoverable loss. The editor for it, and the switch between the two kinds, are T-024
 * (DEC-101).
 *
 * Reading is `viewConfig`; the tests and the score are separate hints and are read even when the
 * configuration is refused, so a reader who may see one and not the other gets what they may see.
 */
export default async function EditExerciseConfigPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const [{ exerciseId }, locale] = await Promise.all([params, getLocale()]);
  const [t, tExercise, exercise] = await Promise.all([
    getTranslations("ExerciseConfig"),
    getTranslations("Exercise"),
    getExerciseDetail(exerciseId, locale),
  ]);

  // Reading an exercise is something any teacher may do, so the fetch above succeeds for somebody
  // who may not see its configuration -- the trap DEC-092 records and T-008 fell into.
  if (exercise.can.viewConfig !== true) forbidden();

  const [data, breadcrumbs] = await Promise.all([
    getExerciseConfigData(exerciseId),
    resolveBreadcrumbs(`/exercises/${exerciseId}/edit-config`, locale),
  ]);

  const readOnly = exercise.can.update !== true || exercise.archivedAt !== null;
  const environmentIds = data.environments.map((entry) => entry.runtimeEnvironmentId);
  const isAdvanced = exercise.configurationType === "advancedExerciseConfig";

  const weights =
    data.score?.calculator === "weighted"
      ? ((data.score.config as { testWeights?: Record<string, number> } | null)?.testWeights ?? {})
      : {};

  const capabilities = configCapabilities(environmentIds, data.pipelines);
  const values = readSimpleConfig(data.config, data.tests, environmentIds);
  const testNames = Object.fromEntries(data.tests.map((test) => [String(test.id), test.name]));
  const environmentNames = Object.fromEntries(
    data.availableEnvironments.map((environment) => [environment.id, environment.longName]),
  );

  return (
    <PageShell
      title={t("title")}
      subtitle={exercise.name}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/exercises/${exerciseId}/edit`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("settings")}
          </Link>
          <Link
            href={`/exercises/${exerciseId}/edit-limits`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("limits")}
          </Link>
          <Link
            href={`/exercises/${exerciseId}`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("backToExercise")}
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-10">
        {exercise.isBroken && (
          <section
            aria-labelledby="config-broken"
            className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm"
          >
            <h2 id="config-broken" className="font-medium">
              {t("broken.title")}
            </h2>
            <ul className="mt-2 list-disc pl-5">
              {exercise.validationErrors.map((error) => (
                <li key={error}>{describeValidationError(error, tExercise)}</li>
              ))}
            </ul>
          </section>
        )}

        {exercise.archivedAt !== null && (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            {t("archivedNotice")}
          </p>
        )}
        {exercise.archivedAt === null && exercise.can.update !== true && (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            {t("readOnlyNotice")}
          </p>
        )}

        <section aria-labelledby="config-tests" className="flex flex-col gap-3">
          <div>
            <h2 id="config-tests" className="text-base font-semibold tracking-tight">
              {t("tests.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("tests.explain")}</p>
          </div>
          <TestsForm
            exerciseId={exerciseId}
            tests={data.tests}
            calculator={data.score?.calculator ?? "uniform"}
            weights={weights}
            readOnly={readOnly}
          />
        </section>

        <section aria-labelledby="config-environments" className="flex flex-col gap-3">
          <div>
            <h2 id="config-environments" className="text-base font-semibold tracking-tight">
              {t("environments.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("environments.explain")}</p>
          </div>
          {isAdvanced ? (
            <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              {t("advanced.environments")}
            </p>
          ) : (
            <EnvironmentsForm
              exerciseId={exerciseId}
              available={data.availableEnvironments}
              selected={environmentIds}
              readOnly={readOnly}
            />
          )}
        </section>

        <section aria-labelledby="config-tests-config" className="flex flex-col gap-3">
          <div>
            <h2 id="config-tests-config" className="text-base font-semibold tracking-tight">
              {t("config.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("config.explain")}</p>
          </div>
          {isAdvanced ? (
            <p className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
              {t("advanced.config")}
            </p>
          ) : data.configRefused ? (
            <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              {t("config.refused")}
            </p>
          ) : data.tests.length === 0 || environmentIds.length === 0 ? (
            <div className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
              <p>{t("config.unavailable")}</p>
              <ul className="mt-2 list-disc pl-5">
                {data.tests.length === 0 && <li>{t("config.noTests")}</li>}
                {environmentIds.length === 0 && <li>{t("config.noEnvironments")}</li>}
              </ul>
            </div>
          ) : (
            <>
              {capabilities.withoutPipelines.length > 0 && (
                <p className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
                  {t("config.noPipelines", {
                    environments: capabilities.withoutPipelines
                      .map((id) => environmentNames[id] ?? id)
                      .join(", "),
                  })}
                </p>
              )}
              <TestConfigForm
                exerciseId={exerciseId}
                values={values}
                testNames={testNames}
                environments={environmentIds}
                environmentNames={environmentNames}
                capabilities={capabilities}
                files={exercise.files.map((file) => file.name)}
                readOnly={readOnly}
              />
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
