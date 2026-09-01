"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { deleteAssignment } from "@/lib/actions/assignment";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Removing an assignment, on the screen that owns the rest of its settings (T-002).
 *
 * Offered on core-api's own `remove` hint, and it confirms first: **everything submitted to it
 * goes with it**. It exists because T-001 made creating an assignment a single click -- without
 * this, assigning the wrong exercise would be permanent, the same one-way door S-026 was filed to
 * close for groups.
 */
export function DeleteAssignment({
  assignmentId,
  groupId,
}: {
  assignmentId: string;
  groupId: string | null;
}) {
  const t = useTranslations("AssignmentEdit.delete");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function run() {
    setPending(true);
    const result = await deleteAssignment(assignmentId);
    if (result.success) {
      toast.success(t("deleted"));
      router.push(groupId === null ? "/dashboard" : `/groups/${groupId}?tab=assignments`);
      return;
    }
    setPending(false);
    setConfirming(false);
    toast.error(t("failed"), result.formError);
  }

  return (
    <section aria-labelledby="assignment-delete" className="flex flex-col gap-2">
      <h2 id="assignment-delete" className="text-base font-semibold tracking-tight">
        {t("title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("explain")}</p>
      <div>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          {t("action")}
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title={t("confirm.title")}
        description={t("confirm.description")}
        pending={pending}
        onConfirm={() => void run()}
      />
    </section>
  );
}
