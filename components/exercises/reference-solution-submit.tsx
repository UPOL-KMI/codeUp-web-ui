"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  preSubmitReferenceSolution,
  submitReferenceSolution,
} from "@/lib/actions/reference-solutions";
import type { UploadedFile } from "@/lib/upload/chunked-upload";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";
import { FileUpload } from "@/components/upload/file-upload";

/**
 * Submitting a new reference solution (T-011).
 *
 * Two calls, the same shape S-014's student submission takes: **`pre-submit` first**, which asks
 * core-api what the uploaded files amount to, and `submit` only once there is an answer. That is
 * what makes the language a *reported* fact rather than something the author has to know -- which
 * extensions belong to which environment is core-api's rule, and copying it here would be a second
 * copy of a thing that changes when an instance adds a language.
 *
 * The pre-submit answer is also the honest place to find out that **the files do not suit this
 * exercise at all**: an exercise configured only for Python, handed a `.java`, comes back with no
 * environments, and this says so rather than offering an empty select.
 */
export function SubmitReferenceSolution({
  exerciseId,
  environmentNames,
}: {
  exerciseId: string;
  environmentNames: Record<string, string>;
}) {
  const t = useTranslations("ReferenceSolutions.submit");
  const router = useRouter();
  const toast = useToast();
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [environments, setEnvironments] = useState<string[] | null>(null);
  const [environment, setEnvironment] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function filesChanged(files: UploadedFile[]) {
    setUploaded(files);
    // Any change to the file set invalidates what core-api said about the previous one.
    setEnvironments(null);
    setEnvironment("");
    setError(null);
  }

  async function ask() {
    setPending(true);
    setError(null);
    const result = await preSubmitReferenceSolution(
      exerciseId,
      uploaded.map((file) => file.id),
    );
    setPending(false);
    if (!result.success) {
      setError(result.formError ?? t("failed"));
      return;
    }
    setEnvironments(result.data.environments);
    setEnvironment(result.data.environments[0] ?? "");
  }

  async function submit() {
    setPending(true);
    setError(null);
    const result = await submitReferenceSolution(exerciseId, {
      uploadedFileIds: uploaded.map((file) => file.id),
      environmentId: environment,
      note,
    });
    setPending(false);
    if (!result.success) {
      setError(result.formError ?? t("failed"));
      return;
    }
    toast.success(t("submitted"));
    setUploaded([]);
    setEnvironments(null);
    setEnvironment("");
    setNote("");
    router.refresh();
  }

  const input =
    "rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("explain")}</p>
      <FileUpload onUploadedFilesChange={filesChanged} disabled={pending} />

      <label className="flex flex-col gap-1 text-sm sm:w-96">
        {t("note")}
        <input
          type="text"
          className={input}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <span className="text-xs text-muted-foreground">{t("noteExplain")}</span>
      </label>

      {environments === null ? (
        <div>
          <button
            type="button"
            disabled={pending || uploaded.length === 0}
            onClick={() => void ask()}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {pending ? t("checking") : t("check")}
          </button>
        </div>
      ) : environments.length === 0 ? (
        <p role="alert" className="text-sm text-destructive">
          {t("noEnvironments")}
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            {t("language")}
            <select
              className={input}
              aria-label={t("language")}
              value={environment}
              onChange={(event) => setEnvironment(event.target.value)}
            >
              {environments.map((id) => (
                <option key={id} value={id}>
                  {environmentNames[id] ?? id}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending || !environment}
            onClick={() => void submit()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {pending ? t("submitting") : t("submit")}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
