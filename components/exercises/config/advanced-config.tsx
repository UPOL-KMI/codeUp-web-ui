"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  previewSwitchToSimple,
  setAdvancedEnvironment,
  setAdvancedPipelines,
  switchToAdvancedConfig,
  switchToSimpleConfig,
  updateAdvancedConfig,
  type SwitchPreview,
} from "@/lib/actions/exercise-advanced";
import type { AdvancedConfigValues } from "@/lib/exercise-config/advanced-config";
import type { ConfigVariable } from "@/lib/exercise-config/types";
import { isArrayType } from "@/lib/pipelines/types";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";

/**
 * The advanced exercise configuration (T-024), and the switch between the two kinds.
 *
 * **The switch is why this ticket exists.** T-009 refuses to rewrite an advanced configuration
 * through the simple form, which is right, and left an exercise in that state with no way out of
 * this app -- the one-way door S-026 and T-001 were each filed for. Both directions are here now,
 * and they are not symmetrical: going *to* advanced changes a flag and loses nothing, so it is a
 * button; coming *back* rebuilds the configuration out of the instance's own pipelines, so it
 * confirms -- and names the variables and pipelines that will actually be dropped, read from the
 * exercise rather than described in the abstract.
 *
 * What an advanced configuration is: **one language, one pipeline list shared by every test, and
 * every variable those pipelines ask for, filled in by hand.** Which variables those are is not
 * guessed -- `POST /config/variables` answers it, which is the only reason this editor can exist
 * without carrying a copy of the pipeline vocabulary the way T-009's simple form has to.
 */
export function AdvancedConfigEditor({
  exerciseId,
  isAdvanced,
  values,
  testNames,
  pipelines,
  chosenPipelines,
  environments,
  environmentId,
  environmentVariables,
  suggestedVariables,
  readOnly,
}: {
  exerciseId: string;
  isAdvanced: boolean;
  values: AdvancedConfigValues | null;
  testNames: Record<string, string>;
  pipelines: { id: string; name: string; environments: string[] }[];
  chosenPipelines: string[];
  environments: { id: string; name: string }[];
  environmentId: string | null;
  environmentVariables: ConfigVariable[];
  /** File-typed names the chosen pipelines mention, with how many mention each. */
  suggestedVariables: Record<string, number>;
  readOnly: boolean;
}) {
  const t = useTranslations("ExerciseAdvanced");
  const router = useRouter();
  const toast = useToast();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SwitchPreview | null>(null);
  const [chosen, setChosen] = useState<string[]>(chosenPipelines);
  const [environment, setEnvironment] = useState(environmentId ?? "");
  const [table, setTable] = useState<ConfigVariable[]>(environmentVariables);
  const [config, setConfig] = useState<AdvancedConfigValues | null>(values);

  async function run(call: () => Promise<ActionResult<unknown>>, successKey: string) {
    setPending(true);
    setError(null);
    const result = await call();
    setPending(false);
    if (!result.success) {
      setError(result.formError ?? t("errors.generic"));
      return false;
    }
    toast.success(t(successKey));
    router.refresh();
    return true;
  }

  const input =
    "rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring";
  const small = `${input} text-xs`;

  if (!isAdvanced) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("toAdvanced.explain")}</p>
        {!readOnly && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void run(() => switchToAdvancedConfig(exerciseId), "toAdvanced.done")}
            className="self-start rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("toAdvanced.action")}
          </button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  const forEnvironment = pipelines.filter(
    (pipeline) => !environment || pipeline.environments.includes(environment),
  );

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="advanced-environment" className="flex flex-col gap-3">
        <div>
          <h3 id="advanced-environment" className="text-sm font-semibold">
            {t("environment.title")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("environment.explain")}</p>
        </div>

        <label className="flex flex-col gap-1 text-sm sm:w-72">
          {t("environment.language")}
          <select
            className={input}
            aria-label={t("environment.language")}
            disabled={readOnly}
            value={environment}
            onChange={(event) => setEnvironment(event.target.value)}
          >
            <option value="">{t("environment.choose")}</option>
            {environments.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{t("environment.variables")}</p>
          <p className="text-xs text-muted-foreground">{t("environment.variablesExplain")}</p>
          {table.map((variable, index) => (
            <span key={index} className="flex flex-wrap items-center gap-1">
              <input
                type="text"
                list="advanced-variable-names"
                className={`${small} w-44 font-mono`}
                aria-label={t("environment.nameOf", { index: index + 1 })}
                disabled={readOnly}
                value={variable.name}
                onChange={(event) =>
                  setTable((previous) =>
                    previous.map((entry, at) =>
                      at === index ? { ...entry, name: event.target.value } : entry,
                    ),
                  )
                }
              />
              <select
                className={small}
                aria-label={t("environment.typeOf", { name: variable.name })}
                disabled={readOnly}
                value={variable.type}
                onChange={(event) =>
                  setTable((previous) =>
                    previous.map((entry, at) =>
                      at === index
                        ? {
                            ...entry,
                            type: event.target.value,
                            value: isArrayType(event.target.value) ? [] : "",
                          }
                        : entry,
                    ),
                  )
                }
              >
                {["file", "file[]", "remote-file", "remote-file[]", "string", "string[]"].map(
                  (type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ),
                )}
              </select>
              <input
                type="text"
                className={`${small} w-56 font-mono`}
                aria-label={t("environment.valueOf", { name: variable.name })}
                placeholder={isArrayType(variable.type) ? t("environment.listHint") : ""}
                disabled={readOnly}
                value={Array.isArray(variable.value) ? variable.value.join(", ") : variable.value}
                onChange={(event) =>
                  setTable((previous) =>
                    previous.map((entry, at) =>
                      at === index
                        ? {
                            ...entry,
                            value: isArrayType(entry.type)
                              ? event.target.value
                                  .split(",")
                                  .map((part) => part.trim())
                                  .filter(Boolean)
                              : event.target.value,
                          }
                        : entry,
                    ),
                  )
                }
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setTable((previous) => previous.filter((_, at) => at !== index))}
                  className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
                >
                  {t("remove")}
                </button>
              )}
              {variable.name && suggestedVariables[variable.name] === undefined && (
                <span className="text-xs text-warning">{t("environment.unused")}</span>
              )}
            </span>
          ))}
          {/* The names the chosen pipelines would actually pick up. A table is free-form, and a
              name nothing reads does nothing at all, silently -- so the ones that work are offered
              and anything else may still be typed. */}
          <datalist id="advanced-variable-names">
            {Object.keys(suggestedVariables).map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {!readOnly && (
            <button
              type="button"
              onClick={() =>
                setTable((previous) => [...previous, { name: "", type: "file[]", value: [] }])
              }
              className="self-start rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
            >
              {t("environment.addVariable")}
            </button>
          )}
        </div>

        {!readOnly && (
          <button
            type="button"
            disabled={pending || !environment}
            onClick={() =>
              void run(
                () => setAdvancedEnvironment(exerciseId, environment, table),
                "environment.saved",
              )
            }
            className="self-start rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
          >
            {t("environment.save")}
          </button>
        )}
      </section>

      <section aria-labelledby="advanced-pipelines" className="flex flex-col gap-3">
        <div>
          <h3 id="advanced-pipelines" className="text-sm font-semibold">
            {t("pipelines.title")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("pipelines.explain")}</p>
        </div>

        {forEnvironment.length === 0 ? (
          <p className="text-sm text-warning">{t("pipelines.none")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {forEnvironment.map((pipeline) => (
              <li key={pipeline.id}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={readOnly}
                    checked={chosen.includes(pipeline.id)}
                    onChange={(event) =>
                      setChosen((previous) =>
                        event.target.checked
                          ? [...previous, pipeline.id]
                          : previous.filter((id) => id !== pipeline.id),
                      )
                    }
                  />
                  {pipeline.name}
                </label>
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending || chosen.length === 0}
              onClick={() =>
                void run(() => setAdvancedPipelines(exerciseId, chosen), "pipelines.saved")
              }
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
            >
              {t("pipelines.save")}
            </button>
            <p className="text-xs text-muted-foreground">{t("pipelines.saveNote")}</p>
          </div>
        )}
      </section>

      <section aria-labelledby="advanced-values" className="flex flex-col gap-3">
        <div>
          <h3 id="advanced-values" className="text-sm font-semibold">
            {t("values.title")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("values.explain")}</p>
        </div>

        {!config || config.tests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("values.nothing")}</p>
        ) : (
          config.tests.map((test, testIndex) => (
            <details
              key={test.id}
              open={config.tests.length === 1}
              className="rounded-lg border border-border"
            >
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                {testNames[test.id] ?? test.id}
              </summary>
              <div className="flex flex-col gap-4 border-t border-border p-3">
                {test.pipelines.map((pipeline, pipelineIndex) => (
                  <div key={pipeline.id} className="flex flex-col gap-1">
                    <p className="text-xs font-semibold">
                      {pipelines.find((entry) => entry.id === pipeline.id)?.name ?? pipeline.id}
                    </p>
                    {pipeline.variables.map((variable, variableIndex) => (
                      <label
                        key={variable.name}
                        className="flex flex-wrap items-center gap-2 text-xs"
                      >
                        <span className="w-40 shrink-0 truncate font-mono">{variable.name}</span>
                        <span className="w-24 shrink-0 text-muted-foreground">{variable.type}</span>
                        <input
                          type="text"
                          className={`${small} min-w-0 flex-1 font-mono`}
                          aria-label={t("values.variableOf", {
                            test: testNames[test.id] ?? test.id,
                            variable: variable.name,
                          })}
                          placeholder={isArrayType(variable.type) ? t("environment.listHint") : ""}
                          disabled={readOnly}
                          value={
                            Array.isArray(variable.value)
                              ? variable.value.join(", ")
                              : variable.value
                          }
                          onChange={(event) =>
                            setConfig((previous) => {
                              if (!previous) return previous;
                              const tests = previous.tests.map((entry, at) => {
                                if (at !== testIndex) return entry;
                                const list = entry.pipelines.map((line, lineAt) => {
                                  if (lineAt !== pipelineIndex) return line;
                                  const variables = line.variables.map((current, currentAt) =>
                                    currentAt === variableIndex
                                      ? {
                                          ...current,
                                          value: isArrayType(current.type)
                                            ? event.target.value
                                                .split(",")
                                                .map((part) => part.trim())
                                                .filter(Boolean)
                                            : event.target.value,
                                        }
                                      : current,
                                  );
                                  return { ...line, variables };
                                });
                                return { ...entry, pipelines: list };
                              });
                              return { ...previous, tests };
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          ))
        )}

        {!readOnly && config && config.tests.length > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void run(() => updateAdvancedConfig(exerciseId, config), "values.saved")}
            className="self-start rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("values.save")}
          </button>
        )}
      </section>

      {!readOnly && (
        <section aria-labelledby="advanced-switch" className="flex flex-col gap-2">
          <h3 id="advanced-switch" className="text-sm font-semibold">
            {t("toSimple.title")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("toSimple.explain")}</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void previewSwitchToSimple(exerciseId).then((result) => {
                setPending(false);
                if (!result.success) {
                  setError(result.formError ?? t("errors.generic"));
                  return;
                }
                setPreview(result.data);
              });
            }}
            className="self-start rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
          >
            {t("toSimple.action")}
          </button>
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title={t("toSimple.confirm.title")}
        description={
          <span className="flex flex-col gap-2">
            <span>{t("toSimple.confirm.description")}</span>
            {preview && preview.droppedVariables.length > 0 && (
              <span className="block">
                {t("toSimple.confirm.variables", {
                  variables: preview.droppedVariables.join(", "),
                })}
              </span>
            )}
            {preview && preview.droppedPipelines.length > 0 && (
              <span className="block">
                {t("toSimple.confirm.pipelines", {
                  pipelines: preview.droppedPipelines.join(", "),
                })}
              </span>
            )}
            {preview &&
              preview.droppedVariables.length === 0 &&
              preview.droppedPipelines.length === 0 && (
                <span className="block">{t("toSimple.confirm.nothingLost")}</span>
              )}
          </span>
        }
        confirmLabel={t("toSimple.confirm.action")}
        pending={pending}
        onConfirm={() => {
          setPreview(null);
          void run(() => switchToSimpleConfig(exerciseId), "toSimple.done");
        }}
      />
    </div>
  );
}
