"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { deleteSolutionSubmission } from "@/lib/actions/solution-rerun";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Removing one run of a solution (G-004), the student-side twin of G-014's control.
 *
 * Offered only where core-api would allow it: the `deleteEvaluation` hint **and** a second run,
 * because `checkDeleteSubmission` refuses the last one with a `BadRequestException` that is not a
 * permission problem and that nothing in the payload announces.
 *
 * **Deleting the run being shown navigates back to the solution's own URL**, because `?submission=`
 * would otherwise point at something that no longer exists and answer 404 on the next render.
 */
export function DeleteSubmission({
  submissionId,
  selected,
  solutionPath,
}: {
  submissionId: string;
  selected: boolean;
  solutionPath: string;
}) {
  const t = useTranslations("Solution.runs");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function remove() {
    setPending(true);
    const result = await deleteSolutionSubmission(submissionId);
    setPending(false);
    setConfirming(false);
    if (!result.success) {
      toast.error(t("errors.deleteFailed"), result.formError);
      return;
    }
    toast.success(t("toast.deleted"));
    if (selected) router.push(solutionPath);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        aria-disabled={pending}
        className="rounded-md border border-destructive px-2 py-1 text-xs text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:opacity-60"
        onClick={() => setConfirming(true)}
      >
        {t("delete")}
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title={t("confirmDelete.title")}
        description={t("confirmDelete.description")}
        pending={pending}
        onConfirm={() => void remove()}
        confirmLabel={t("confirmDelete.confirm")}
      />
    </>
  );
}
