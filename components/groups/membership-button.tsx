"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { joinGroup, leaveGroup } from "@/lib/actions/group-membership";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Join this group, or stop studying in it (S-026).
 *
 * Leaving confirms and joining does not, for the reason S-009's controls use: joining is one click
 * from being undone, and leaving discards the reader's standing in the group from their own view
 * of it. Neither is offered unless the page decided it applies -- see the group screen for why
 * that decision is made from the group's own fields rather than from a permission hint (DEC-090).
 */
export function MembershipButton({
  groupId,
  action,
}: {
  groupId: string;
  action: "join" | "leave";
}) {
  const t = useTranslations("Group.membership");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function run() {
    setPending(true);
    const result = await (action === "join" ? joinGroup(groupId) : leaveGroup(groupId));
    setPending(false);
    setConfirming(false);
    if (result.success) {
      toast.success(t(action === "join" ? "joined" : "left"));
      router.refresh();
    } else {
      toast.error(t(`errors.${action}Failed`), result.formError);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => (action === "join" ? void run() : setConfirming(true))}
        className={
          action === "join"
            ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            : "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        }
      >
        {t(action)}
      </button>

      {action === "leave" && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={(open) => !open && setConfirming(false)}
          title={t("confirmLeave.title")}
          description={t("confirmLeave.description")}
          pending={pending}
          onConfirm={() => void run()}
        />
      )}
    </>
  );
}
