"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { attachPipelineFiles, deletePipelineFile } from "@/lib/actions/pipeline-files";
import type { PipelineFileEntry } from "@/lib/api/pipeline-files";
import { formatBytes } from "@/lib/format/bytes";
import type { ActionResult } from "@/lib/forms/action-result";
import type { UploadedFile } from "@/lib/upload/chunked-upload";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { FileUpload } from "@/components/upload/file-upload";
import { buttonClasses } from "@/components/button";

/**
 * A pipeline's supplementary files (G-015) -- the files a box means when it names a remote one.
 *
 * Modelled on T-023's `ExerciseFiles` because it is core-api's same upload action underneath, and
 * shorter for one reason: **there are no file links here.** A link exists so that `%%key%%` in an
 * authored text resolves to a URL, and a pipeline has no authored text.
 *
 * Two things this screen has to say out loud, because neither is visible from the row:
 *
 * **Removing a file can break the pipeline silently.** Boxes reference files by *name*; core-api
 * lets the file go and the structure keeps the name, so what was a working pipeline becomes one
 * that fails at evaluation time with nothing on screen to point at. Worse than the exercise case,
 * because a pipeline is shared machinery -- every exercise configured against it is affected.
 *
 * **A download is not offered to everybody who can see the list.** `permissions.neon` grants the
 * bytes on ownership (or to a superadmin) and a pipeline file matches none of its other
 * conditions, so a supervisor who may *replace* the file may not *read* it -- see
 * `canDownloadPipelineFile` and Q-026. Rather than render a link that would 403, the name is left
 * as plain text.
 */
export function PipelineFiles({
  pipelineId,
  files,
  readOnly,
  downloadableIds,
}: {
  pipelineId: string;
  files: PipelineFileEntry[];
  readOnly: boolean;
  /** Which rows get a link. Decided on the server, where the viewer's role is known. */
  downloadableIds: string[];
}) {
  const t = useTranslations("PipelineEdit.files");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [deleting, setDeleting] = useState<PipelineFileEntry | null>(null);

  async function run(call: () => Promise<ActionResult<unknown>>, successKey: string) {
    setPending(true);
    const result = await call();
    setPending(false);
    if (!result.success) {
      toast.error(result.formError ?? t("errors.generic"));
      return false;
    }
    toast.success(t(successKey));
    router.refresh();
    return true;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("explain")}</p>

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                {downloadableIds.includes(file.id) ? (
                  <a
                    href={`/api/pipelines/${pipelineId}/files/${file.id}`}
                    className="block truncate font-mono text-sm text-primary underline underline-offset-2"
                  >
                    {file.name}
                  </a>
                ) : (
                  <span className="block truncate font-mono text-sm">{file.name}</span>
                )}
                <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
              </span>
              {!readOnly && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setDeleting(file)}
                  className={buttonClasses("outline", "xs", "shrink-0")}
                >
                  {t("remove")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("upload")}</h3>
          <p className="text-xs text-muted-foreground">{t("uploadExplain")}</p>
          <FileUpload onUploadedFilesChange={setUploaded} disabled={pending} />
          <div>
            <button
              type="button"
              disabled={pending || uploaded.length === 0}
              onClick={() =>
                void run(
                  () =>
                    attachPipelineFiles(
                      pipelineId,
                      uploaded.map((file) => file.id),
                    ),
                  "attached",
                ).then((ok) => {
                  if (ok) setUploaded([]);
                })
              }
              className={buttonClasses("primary", "sm")}
            >
              {t("attach", { count: uploaded.length })}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("confirmRemove.title")}
        description={t("confirmRemove.description", { name: deleting?.name ?? "" })}
        confirmLabel={t("confirmRemove.confirm")}
        pending={pending}
        onConfirm={() => {
          const file = deleting;
          setDeleting(null);
          if (file) void run(() => deletePipelineFile(pipelineId, file.id), "removed");
        }}
      />
    </div>
  );
}
