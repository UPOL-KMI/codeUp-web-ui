import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getExerciseConfigData } from "@/lib/api/exercise-config";
import { getExerciseDetail } from "@/lib/api/exercise-detail";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { describeValidationError } from "@/lib/status/exercise-validation";
import { configCapabilities, readSimpleConfig } from "@/lib/exercise-config/simple-config";
import {
  configuredEnvironment,
  configuredPipelines,
  possibleEnvironmentVariables,
  readAdvancedConfig,
} from "@/lib/exercise-config/advanced-config";
import { askPipelineVariables } from "@/lib/actions/exercise-advanced";
import type { ScoreNode } from "@/lib/exercise-config/score-expression";

import { Link } from "@/i18n/navigation";
import { AdvancedConfigEditor } from "@/components/exercises/config/advanced-config";
import { ScoreExpressionEditor } from "@/components/exercises/config/score-expression";
import { EnvironmentsForm } from "@/components/exercises/config/environments-form";
import { TestConfigForm } from "@/components/exercises/config/test-config-form";
import { TestsForm } from "@/components/exercises/config/tests-form";
import { PageShell } from "@/components/page-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ExerciseConfig" });
  return { title: t("title") };
}

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
 * **Two kinds of configuration, and the screen shows whichever this exercise has.** The simple
 * kind is the three forms above; the advanced kind -- built out of hand-picked pipelines -- has its
 * own editor (T-024), because rewriting one through the simple form would replace those pipelines
 * with the instance's default ones and lose everything configured on them (DEC-101). The switch
 * between them lives at the bottom of the advanced editor and is not symmetrical: going to
 * advanced loses nothing, coming back rebuilds, so only one of them confirms.
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
  const [t, tExercise, tAdvanced, tScore, exercise] = await Promise.all([
    getTranslations("ExerciseConfig"),
    getTranslations("Exercise"),
    getTranslations("ExerciseAdvanced"),
    getTranslations("ExerciseScore"),
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

  const advancedPipelines = isAdvanced ? configuredPipelines(data.config) : [];
  const advancedEnvironment = isAdvanced ? configuredEnvironment(data.config) : null;
  // Which variables each chosen pipeline asks for is core-api's answer, not a guess -- the one
  // endpoint T-009 never had to call, and the whole basis of the advanced editor.
  const declared =
    isAdvanced && advancedEnvironment && advancedPipelines.length > 0
      ? await askPipelineVariables(exerciseId, advancedEnvironment, advancedPipelines)
      : null;
  const advancedValues =
    declared?.success && advancedEnvironment
      ? readAdvancedConfig(data.config, data.tests, advancedEnvironment, declared.data)
      : null;

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
          {/* Keyed by what core-api holds. Saving tests **changes their ids** -- core-api copies a
              renamed test rather than updating it -- and a form still bound to the ids it mounted
              with would send `id: null` for tests that exist, which core-api refuses as a name
              already taken. Found by T-025's spec saving this form twice in a row. */}
          <TestsForm
            key={`${data.score?.calculator ?? "uniform"}:${data.tests.map((test) => test.id).join(",")}`}
            exerciseId={exerciseId}
            tests={data.tests}
            calculator={data.score?.calculator ?? "uniform"}
            weights={weights}
            readOnly={readOnly}
          />
        </section>

        <section aria-labelledby="config-score" className="flex flex-col gap-3">
          <div>
            <h2 id="config-score" className="text-base font-semibold tracking-tight">
              {tScore("title")}
            </h2>
            <p className="text-sm text-muted-foreground">{tScore("explain")}</p>
          </div>
          {/* Keyed by what core-api holds, so switching onto the expression -- or saving one --
              re-seeds the field from the tree that was actually stored, rather than leaving the
              editor showing the state it mounted with. Same reason T-016's and T-024's editors are
              keyed; a text field seeded once from a prop is otherwise a stale copy after any save. */}
          <ScoreExpressionEditor
            key={`${data.score?.calculator ?? "uniform"}:${JSON.stringify(data.score?.config ?? null)}`}
            exerciseId={exerciseId}
            isUniversal={data.score?.calculator === "universal"}
            /* Only the universal calculator's `config` is an expression tree; the weighted one's
               is `{testWeights}`, and handing that to the printer is how this page crashed once. */
            expression={
              data.score?.calculator === "universal"
                ? ((data.score.config as ScoreNode | null) ?? null)
                : null
            }
            testNames={data.tests.map((test) => test.name)}
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
            /* Keyed by the two structural choices. Saving either the language or the pipeline
               list rebuilds the configuration on core-api's side, so the editor has to re-seed
               from what came back rather than keep the state it was holding -- the same reason
               T-016's structure editor is keyed by its pipeline's version. Saving the *values*
               leaves the key alone, so nothing that was just typed is thrown away. */
            <AdvancedConfigEditor
              key={`${advancedEnvironment ?? ""}:${advancedPipelines.join(",")}`}
              exerciseId={exerciseId}
              isAdvanced
              values={advancedValues}
              testNames={testNames}
              pipelines={data.pipelines.map((pipeline) => ({
                id: pipeline.id,
                name: pipeline.name,
                environments: pipeline.runtimeEnvironmentIds,
              }))}
              chosenPipelines={advancedPipelines}
              environments={data.availableEnvironments}
              environmentId={advancedEnvironment}
              environmentVariables={data.environments[0]?.variablesTable ?? []}
              suggestedVariables={possibleEnvironmentVariables(
                data.pipelineVariables,
                advancedPipelines,
              )}
              readOnly={readOnly}
            />
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

        {!isAdvanced && !readOnly && (
          <section aria-labelledby="config-kind" className="flex flex-col gap-3">
            <div>
              <h2 id="config-kind" className="text-base font-semibold tracking-tight">
                {tAdvanced("toAdvanced.title")}
              </h2>
            </div>
            <AdvancedConfigEditor
              exerciseId={exerciseId}
              isAdvanced={false}
              values={null}
              testNames={testNames}
              pipelines={[]}
              chosenPipelines={[]}
              environments={data.availableEnvironments}
              environmentId={environmentIds[0] ?? null}
              environmentVariables={[]}
              suggestedVariables={{}}
              readOnly={readOnly}
            />
          </section>
        )}
      </div>
    </PageShell>
  );
}
