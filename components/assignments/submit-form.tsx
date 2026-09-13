"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";

import {
  preSubmitSolution,
  submitSolution,
  type SubmittedSolution,
} from "@/lib/actions/submit-solution";
import {
  submitSolutionSchema,
  type SubmitSolutionValues,
} from "@/lib/actions/submit-solution.schema";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";
import type { UploadedFile } from "@/lib/upload/chunked-upload";

import { FormProvider } from "react-hook-form";

import { useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form/form-error";
import { FileUpload } from "@/components/upload/file-upload";
import { buttonClasses } from "@/components/button";

/** Sorted, because the default entry point is the first of them and "first" has to mean the same
 *  thing however the browser happened to order the upload. */
function sortedNames(names: string[]): string[] {
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Submitting a solution (S-014) -- the brief's own "highest-value screen in the app".
 *
 * Three steps, in the order core-api imposes them rather than an order chosen here:
 *
 * 1. **Files upload first**, through D-005's chunked Route Handler, never through the Server
 *    Action. A Server Action's body limit is around 1 MB and solutions are archives (AGENTS.md
 *    footgun 7); by the time this form submits, core-api already holds the files and this only
 *    sends their ids.
 * 2. **`pre-submit` runs once the files exist**, because the environments it offers are derived
 *    from the *file names* (`getEnvironmentsForFiles`) -- there is nothing to ask before then.
 *    It also answers whether the file count and total size are within the assignment's limits,
 *    which is the same check the real submit will make, made early enough to be fixable.
 * 3. **Submit** posts note + file ids + environment, and core-api decides whether it is allowed.
 *
 * The environment is a plain `<select>` rather than a combobox: it is a short list of detected
 * candidates, and a native select is the one control that is keyboard- and screen-reader-correct
 * without any work. It is preselected when core-api offers exactly one, which is the ordinary case
 * -- a Python file has one plausible environment -- so the common path is upload, submit.
 */
export function SubmitForm({
  assignmentId,
  maxBytes,
  environmentNames,
}: {
  assignmentId: string;
  maxBytes?: number;
  /** id → the name a person recognises. An id core-api did not name falls back to itself. */
  environmentNames?: Record<string, string>;
}) {
  const t = useTranslations("Submit");
  const router = useRouter();
  const selectId = useId();
  const entryPointId = useId();
  const noteId = useId();

  const [environments, setEnvironments] = useState<string[]>([]);
  const [entryPointEnvironments, setEntryPointEnvironments] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [limits, setLimits] = useState<{ countOk: boolean; sizeOk: boolean }>({
    countOk: true,
    sizeOk: true,
  });
  const [checking, setChecking] = useState(false);

  const { form, onSubmit, isPending } = useServerActionForm<
    SubmitSolutionValues,
    SubmittedSolution
  >({
    schema: submitSolutionSchema,
    defaultValues: { files: [], runtimeEnvironmentId: "", note: "", entryPoint: "" },
    // The entry point is resolved here rather than held in the field, because the field is the
    // reader's *choice* and the value sent is the choice or a default -- legacy's own split
    // (`SubmitSolutionContainer.getEntryPoint`). An environment that does not ask for one sends
    // nothing at all.
    //
    // Read off `values` and plain state rather than the derived `needsEntryPoint` below: this
    // closure is part of the same hook call that produces `form`, so reaching for anything
    // `form.watch()` derived would make the component's own types circular.
    action: (values) =>
      submitSolution(assignmentId, {
        ...values,
        entryPoint: entryPointEnvironments.includes(values.runtimeEnvironmentId)
          ? values.entryPoint || sortedNames(fileNames)[0] || ""
          : "",
      }),
    // The monitor channel travels in the URL because that is the only place it can: core-api
    // hands it out once, here, and the solution screen is a fresh server render that cannot ask
    // for it again (S-016).
    onSuccess: ({ solutionId, monitorChannelId, expectedTasks }) =>
      router.push(
        monitorChannelId
          ? `/solutions/${solutionId}?monitor=${encodeURIComponent(monitorChannelId)}&tasks=${expectedTasks}`
          : `/solutions/${solutionId}`,
      ),
  });

  const {
    formState: { errors },
    register,
    setValue,
    watch,
  } = form;
  const files = watch("files");
  const selectedEnvironment = watch("runtimeEnvironmentId");
  const entryPoint = watch("entryPoint");

  const entryPointChoices = sortedNames(fileNames);
  const needsEntryPoint =
    selectedEnvironment !== "" && entryPointEnvironments.includes(selectedEnvironment);

  async function handleUploadedFiles(uploaded: UploadedFile[]) {
    const ids = uploaded.map((file) => file.id);
    setValue("files", ids, { shouldValidate: ids.length > 0 });
    setFileNames(uploaded.map((file) => file.name));

    if (ids.length === 0) {
      setEnvironments([]);
      setEntryPointEnvironments([]);
      setValue("runtimeEnvironmentId", "");
      return;
    }

    setChecking(true);
    const result = await preSubmitSolution(assignmentId, ids);
    setChecking(false);
    if (!result.success) {
      form.setError("root", { message: result.formError ?? t("errors.preSubmitFailed") });
      return;
    }

    setEnvironments(result.data.environments);
    setEntryPointEnvironments(result.data.entryPointEnvironments);
    setLimits({ countOk: result.data.countLimitOk, sizeOk: result.data.sizeLimitOk });
  }

  // Preselect only when there is no choice to make -- offering one option and asking the reader to
  // pick it is a step that exists for the form's benefit, not theirs.
  //
  // In an effect, and this one is not incidental: React Hook Form's `setValue` writes straight to
  // the DOM node, so calling it in the same tick as `setEnvironments` sets a value the `<select>`
  // does not have an `<option>` for yet, and the browser silently discards it. Found live -- the
  // select rendered "Choose a language" with python3 sitting right below it. Running after the
  // render that adds the options is what makes the write land.
  useEffect(() => {
    setValue("runtimeEnvironmentId", environments.length === 1 ? environments[0]! : "", {
      shouldValidate: environments.length > 0,
    });
  }, [environments, setValue]);

  // A pick only means something while the file it names is still uploaded: removing that file has
  // to clear it, or the submission names a file core-api no longer holds. Legacy clears it the
  // same way (`SubmitSolutionContainer.getDerivedStateFromProps`).
  useEffect(() => {
    const current = form.getValues("entryPoint");
    if (current && !fileNames.includes(current)) setValue("entryPoint", "");
  }, [fileNames, setValue, form]);

  const blocked = !limits.countOk || !limits.sizeOk;
  // Legacy's own rule (`SubmitSolutionContainer.needsToSelectEntryPoint`): with one file the entry
  // point is that file and asking would be a question with one answer; with several, a default
  // taken by sort order is a guess, and guessing which file is the program is the kind of wrong
  // that surfaces as a failed test rather than as an error.
  const mustChooseEntryPoint = needsEntryPoint && entryPointChoices.length > 1 && !entryPoint;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div>
          <h2 className="mb-2 text-base font-semibold tracking-tight">{t("files")}</h2>
          <FileUpload
            onUploadedFilesChange={handleUploadedFiles}
            disabled={isPending}
            maxBytes={maxBytes}
          />
          {errors.files && <FormError message={t("errors.noFiles")} />}
          {!limits.countOk && <FormError message={t("errors.tooManyFiles")} />}
          {!limits.sizeOk && <FormError message={t("errors.tooLarge")} />}
        </div>

        {/* **Hidden when there is nothing to choose.** An assignment in one language -- which every
            data-only one is, since that environment cannot share an exercise with another -- left
            the student staring at a select with a single option they had to understand before
            they could submit. The field stays registered and submits the value the effect above
            preselected; it simply is not on screen. */}
        <div className="flex flex-col gap-1" hidden={environments.length === 1}>
          <label htmlFor={selectId} className="text-sm font-medium">
            {t("environment")}
          </label>
          <select
            id={selectId}
            {...register("runtimeEnvironmentId")}
            disabled={environments.length === 0 || isPending}
            aria-invalid={errors.runtimeEnvironmentId ? true : undefined}
            className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">
              {checking
                ? t("detecting")
                : environments.length === 0
                  ? t("uploadFirst")
                  : t("choose")}
            </option>
            {environments.map((environment) => (
              <option key={environment} value={environment}>
                {environmentNames?.[environment] ?? environment}
              </option>
            ))}
          </select>
          {errors.runtimeEnvironmentId && <FormError message={t("errors.noEnvironment")} />}
        </div>

        {needsEntryPoint && entryPointChoices.length > 1 && (
          <div className="flex flex-col gap-1">
            <label htmlFor={entryPointId} className="text-sm font-medium">
              {t("entryPoint")}
            </label>
            <select
              id={entryPointId}
              {...register("entryPoint")}
              disabled={isPending}
              aria-describedby={`${entryPointId}-help`}
              className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{t("chooseEntryPoint")}</option>
              {entryPointChoices.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <p id={`${entryPointId}-help`} className="text-xs text-muted-foreground">
              {t("entryPointHelp")}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor={noteId} className="text-sm font-medium">
            {t("note")}
          </label>
          <textarea
            id={noteId}
            {...register("note")}
            rows={2}
            maxLength={1024}
            placeholder={t("notePlaceholder")}
            className="w-full max-w-xl rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">{t("noteHelp")}</p>
        </div>

        <FormError />

        <div>
          <button
            type="submit"
            disabled={
              isPending ||
              checking ||
              blocked ||
              files.length === 0 ||
              !selectedEnvironment ||
              mustChooseEntryPoint
            }
            className={buttonClasses("primary", "md")}
          >
            {isPending ? t("submitting") : t("submit")}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
