"use client";

import { FormProvider, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { updateExerciseConfig } from "@/lib/actions/exercise-config";
import { configSchema, type ConfigValues } from "@/lib/actions/exercise-config.schema";
import type { ConfigCapabilities, SimpleConfigValues } from "@/lib/exercise-config/simple-config";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";

import { FileListField, FilePairListField, FileSelect, StringListField } from "./fields";

/**
 * What each test actually does (T-009) -- the screen the brief calls the hardest in the product,
 * and the reason it is: one form holds every test of the exercise, and each test holds values that
 * are shared by every language it supports alongside values that are held per language.
 *
 * The split is not arbitrary. What a test *is* -- its input, the output it expects, the judge that
 * compares them -- is the same whatever language wrote the solution. How a solution is *built and
 * started* is not: an entry point, a compiler flag, an acceptable exit code all belong to one
 * environment. So the shared half is edited once and the per-environment half repeats.
 *
 * **Which fields exist is read off the instance's pipelines, not assumed** (`configCapabilities`).
 * Java declares no entry point and C takes no jar files, so neither is offered there; a value the
 * pipelines have no variable for is one core-api would refuse.
 *
 * The nine built-in judges are named here because they are named nowhere else: core-api validates
 * `judge-type` against its own list but does not publish it, so the list is the legacy app's,
 * carried over whole.
 */
const JUDGES = [
  "recodex-judge-normal",
  "recodex-judge-float",
  "recodex-judge-normal-newline",
  "recodex-judge-float-newline",
  "recodex-judge-shuffle",
  "recodex-judge-shuffle-rows",
  "recodex-judge-shuffle-all",
  "recodex-judge-shuffle-newline",
  "diff",
] as const;

const INPUT =
  "rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring";

export function TestConfigForm({
  exerciseId,
  values,
  testNames,
  environments,
  environmentNames,
  capabilities,
  files,
  readOnly,
}: {
  exerciseId: string;
  values: SimpleConfigValues;
  testNames: Record<string, string>;
  environments: string[];
  environmentNames: Record<string, string>;
  capabilities: ConfigCapabilities;
  files: string[];
  readOnly: boolean;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const router = useRouter();
  const toast = useToast();

  const { form, onSubmit, isPending } = useServerActionForm<ConfigValues, { tests: number }>({
    schema: configSchema,
    defaultValues: values as ConfigValues,
    action: (submitted) => updateExerciseConfig(exerciseId, submitted),
    onSuccess: () => {
      toast.success(t("saved"));
      router.refresh();
    },
  });

  const {
    formState: { errors },
  } = form;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {files.length === 0 && (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{t("noFiles")}</p>
        )}

        {values.tests.map((test, index) => (
          <details
            key={test.id}
            open={values.tests.length === 1}
            className="rounded-lg border border-border"
          >
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
              {testNames[test.id] ?? test.id}
            </summary>
            <div className="flex flex-col gap-6 border-t border-border p-4">
              <SharedFields
                index={index}
                files={files}
                readOnly={readOnly}
                canCompareFile={capabilities.canCompareFile}
              />
              {environments.map((environmentId) => (
                <EnvironmentFields
                  key={environmentId}
                  index={index}
                  environmentId={environmentId}
                  environmentName={environmentNames[environmentId] ?? environmentId}
                  fields={capabilities.environments[environmentId]}
                  files={files}
                  readOnly={readOnly}
                  onlyOne={environments.length === 1}
                />
              ))}
            </div>
          </details>
        ))}

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {isPending ? t("saving") : t("save")}
            </button>
            <p className="text-xs text-muted-foreground">{t("saveNote")}</p>
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

function SharedFields({
  index,
  files,
  readOnly,
  canCompareFile,
}: {
  index: number;
  files: string[];
  readOnly: boolean;
  canCompareFile: boolean;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const { register, watch } = useFormContext<ConfigValues>();
  const useOutFile = watch(`tests.${index}.useOutFile`);
  const useCustomJudge = watch(`tests.${index}.useCustomJudge`);

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">{t("input")}</legend>
        <FilePairListField
          name={`tests.${index}.inputFiles`}
          label={t("inputFiles")}
          files={files}
          readOnly={readOnly}
          description={t("inputFilesExplain")}
        />
        <FileSelect
          name={`tests.${index}.stdinFile`}
          label={t("stdinFile")}
          files={files}
          readOnly={readOnly}
          description={t("stdinFileExplain")}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">{t("execution")}</legend>
        <StringListField
          name={`tests.${index}.runArgs`}
          label={t("runArgs")}
          readOnly={readOnly}
          description={t("runArgsExplain")}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">{t("output")}</legend>
        {canCompareFile && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              aria-label={t("useOutFile")}
              disabled={readOnly}
              {...register(`tests.${index}.useOutFile`)}
            />
            <span>
              {t("useOutFile")}
              <span className="block text-xs text-muted-foreground">{t("useOutFileExplain")}</span>
            </span>
          </label>
        )}
        {canCompareFile && useOutFile && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("actualOutput")}</span>
            <input
              type="text"
              className={`${INPUT} font-mono`}
              aria-label={t("actualOutput")}
              disabled={readOnly}
              {...register(`tests.${index}.actualOutput`)}
            />
            <span className="text-xs text-muted-foreground">{t("actualOutputExplain")}</span>
          </label>
        )}
        <FileSelect
          name={`tests.${index}.expectedOutput`}
          label={t("expectedOutput")}
          files={files}
          readOnly={readOnly}
          description={t("expectedOutputExplain")}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">{t("judge")}</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            aria-label={t("useCustomJudge")}
            disabled={readOnly}
            {...register(`tests.${index}.useCustomJudge`)}
          />
          <span>
            {t("useCustomJudge")}
            <span className="block text-xs text-muted-foreground">
              {t("useCustomJudgeExplain")}
            </span>
          </span>
        </label>
        {useCustomJudge ? (
          <>
            <FileSelect
              name={`tests.${index}.customJudge`}
              label={t("customJudge")}
              files={files}
              readOnly={readOnly}
            />
            <StringListField
              name={`tests.${index}.judgeArgs`}
              label={t("judgeArgs")}
              readOnly={readOnly}
              description={t("judgeArgsExplain")}
            />
          </>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("judgeType")}</span>
            <select
              className={INPUT}
              aria-label={t("judgeType")}
              disabled={readOnly}
              {...register(`tests.${index}.judgeType`)}
            >
              {JUDGES.map((judge) => (
                <option key={judge} value={judge}>
                  {t(`judges.${judge}`)}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
    </div>
  );
}

function EnvironmentFields({
  index,
  environmentId,
  environmentName,
  fields,
  files,
  readOnly,
  onlyOne,
}: {
  index: number;
  environmentId: string;
  environmentName: string;
  fields: import("@/lib/exercise-config/simple-config").EnvironmentFields | undefined;
  files: string[];
  readOnly: boolean;
  onlyOne: boolean;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const { register } = useFormContext<ConfigValues>();

  if (!fields) return null;
  const shown =
    fields.entryPoint ||
    fields.successExitCodes ||
    fields.extraFiles ||
    fields.jarFiles ||
    fields.compileArgs ||
    fields.execTargets;
  if (!shown) return null;

  const path = `tests.${index}.environments.${environmentId}` as const;

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
      <legend className="px-1 text-xs font-semibold tracking-wide uppercase">
        {onlyOne ? t("perEnvironmentOnly", { environment: environmentName }) : environmentName}
      </legend>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {fields.entryPoint && (
          <FileSelect
            name={`${path}.entryPoint`}
            label={t("entryPoint")}
            files={files}
            readOnly={readOnly}
            description={t("entryPointExplain")}
          />
        )}
        {fields.successExitCodes && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("successExitCodes")}</span>
            <input
              type="text"
              className={`${INPUT} font-mono`}
              aria-label={t("successExitCodes")}
              disabled={readOnly}
              {...register(`${path}.successExitCodes`)}
            />
            <span className="text-xs text-muted-foreground">{t("successExitCodesExplain")}</span>
          </label>
        )}
        {fields.extraFiles && (
          <FilePairListField
            name={`${path}.extraFiles`}
            label={t("extraFiles")}
            files={files}
            readOnly={readOnly}
            description={t("extraFilesExplain")}
          />
        )}
        {fields.jarFiles && (
          <FileListField
            name={`${path}.jarFiles`}
            label={t("jarFiles")}
            files={files}
            readOnly={readOnly}
            description={t("jarFilesExplain")}
          />
        )}
        {fields.compileArgs && (
          <StringListField
            name={`${path}.compileArgs`}
            label={t("compileArgs")}
            readOnly={readOnly}
            description={t("compileArgsExplain")}
          />
        )}
        {fields.execTargets && (
          <StringListField
            name={`${path}.execTargets`}
            label={t("execTargets")}
            readOnly={readOnly}
            description={t("execTargetsExplain")}
          />
        )}
      </div>
    </fieldset>
  );
}
