"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";

import {
  preSubmitSolution,
  submitSolution,
  type SubmittedSolution,
} from "@/lib/actions/submit-solution";
import { type SubmitSolutionValues } from "@/lib/actions/submit-solution.schema";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";
import type { UploadedFile } from "@/lib/upload/chunked-upload";

import { FormProvider } from "react-hook-form";

import { useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form/form-error";
import { FileUpload } from "@/components/upload/file-upload";

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
}: {
  assignmentId: string;
  maxBytes?: number;
}) {
  const t = useTranslations("Submit");
  const router = useRouter();
  const selectId = useId();
  const noteId = useId();

  const [environments, setEnvironments] = useState<string[]>([]);
  const [limits, setLimits] = useState<{ countOk: boolean; sizeOk: boolean }>({
    countOk: true,
    sizeOk: true,
  });
  const [checking, setChecking] = useState(false);

  const { form, onSubmit, isPending } = useServerActionForm<
    SubmitSolutionValues,
    SubmittedSolution
  >({
    schema: () =>
      import("@/lib/actions/submit-solution.schema").then((module) => module.submitSolutionSchema),
    defaultValues: { files: [], runtimeEnvironmentId: "", note: "" },
    action: (values) => submitSolution(assignmentId, values),
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

  async function handleUploadedFiles(uploaded: UploadedFile[]) {
    const ids = uploaded.map((file) => file.id);
    setValue("files", ids, { shouldValidate: ids.length > 0 });

    if (ids.length === 0) {
      setEnvironments([]);
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

  const blocked = !limits.countOk || !limits.sizeOk;

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

        <div className="flex flex-col gap-1">
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
                {environment}
              </option>
            ))}
          </select>
          {errors.runtimeEnvironmentId && <FormError message={t("errors.noEnvironment")} />}
        </div>

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
              isPending || checking || blocked || files.length === 0 || !selectedEnvironment
            }
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {isPending ? t("submitting") : t("submit")}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
