"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  deleteReferenceSubmission,
  resubmitReferenceSolution,
} from "@/lib/actions/reference-solutions";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

const BUTTON =
  "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:opacity-60";

/**
 * Running a reference solution again (G-014), built to look like G-002's `RerunControls` because
 * it is the same act on the other kind of solution.
 *
 * Debug is a second button rather than a checkbox, for G-002's reason: it is not a variation on
 * the ordinary re-run but what an author reaches for when the ordinary result did not explain
 * itself, and a checkbox left ticked from last time is a surprise.
 *
 * **This one refreshes rather than following the job, and that is a real difference from the
 * student's.** core-api evaluates a reference solution once per **hardware group**, so a resubmit
 * answers with a list of `{submission, webSocketChannel}` rather than the single channel S-016's
 * live progress island watches. Following one of several would be arbitrary; the page reloads with
 * the new runs in its history instead.
 */
export function ReferenceRunControls({
  solutionId,
  canResubmit,
}: {
  solutionId: string;
  canResubmit: boolean;
}) {
  const t = useTranslations("ReferenceSolutions.detail.runs");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  if (!canResubmit) return null;

  async function rerun(debug: boolean) {
    setPending(true);
    const result = await resubmitReferenceSolution(solutionId, debug);
    setPending(false);
    if (!result.success) {
      // core-api's own message says why, and the two commonest whys are worth reading verbatim:
      // the exercise is broken, or its configuration no longer compiles.
      toast.error(t("errors.resubmitFailed"), result.formError);
      return;
    }
    toast.success(t("toast.resubmitted"));
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-disabled={pending}
        className={BUTTON}
        onClick={() => void rerun(false)}
      >
        {t("resubmit")}
      </button>
      <button
        type="button"
        aria-disabled={pending}
        className={BUTTON}
        onClick={() => void rerun(true)}
      >
        {t("resubmitDebug")}
      </button>
    </div>
  );
}

/**
 * Removing one run of a reference solution, keeping the solution (G-014).
 *
 * Offered only where core-api would allow it: the `deleteEvaluation` hint **and** more than one
 * run, because `checkDeleteSubmission` refuses the last one with a `BadRequestException` that is
 * not a permission problem and that no payload announces.
 */
export function DeleteReferenceSubmission({
  submissionId,
  selected,
  solutionPath,
}: {
  submissionId: string;
  /** Deleting the run being shown has to leave the page on one that still exists. */
  selected: boolean;
  solutionPath: string;
}) {
  const t = useTranslations("ReferenceSolutions.detail.runs");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function remove() {
    setPending(true);
    const result = await deleteReferenceSubmission(submissionId);
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
        className={buttonClasses("destructive-outline", "xs")}
        onClick={() => setConfirming(true)}
      >
        {t("deleteRun")}
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
