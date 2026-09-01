"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { closePendingReviews } from "@/lib/actions/solution-review";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Closing every review still open on one student's work (T-005).
 *
 * It confirms first, which the legacy button does not, and the reason is what closing a review
 * *does*: it publishes the comments to the student and mails them. Reopening is possible (S-018's
 * control does it per solution), but "the student has already read it" is not undone by reopening,
 * so this is a one-way door in the sense that matters.
 *
 * Offered only where every solution counted carries core-api's own `review` hint -- the page
 * filters the list before it reaches this component.
 */
export function ClosePendingReviews({ solutionIds }: { solutionIds: string[] }) {
  const t = useTranslations("GroupUserSolutions.pendingReviews");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function run() {
    setPending(true);
    const result = await closePendingReviews(solutionIds);
    setPending(false);
    setConfirming(false);
    if (result.success) {
      toast.success(t("closed", { count: result.data.closed }));
    } else {
      toast.error(t("failed"), result.formError);
    }
    // Either way: some may have closed even when one was refused, and the list is the truth.
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning bg-warning/10 p-4 text-sm">
      <p>{t("note", { count: solutionIds.length })}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(true)}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        {t("action")}
      </button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title={t("confirm.title")}
        description={t("confirm.description", { count: solutionIds.length })}
        confirmLabel={t("action")}
        destructive={false}
        pending={pending}
        onConfirm={() => void run()}
      />
    </div>
  );
}
