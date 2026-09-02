"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { deleteUserAccount, setUserAllowed } from "@/lib/actions/users";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";

/**
 * The two things this screen does to an account (AD-001), both of them consequential enough to
 * ask first.
 *
 * **Disabling is offered on everybody but the reader.** core-api refuses to change the flag on
 * one's own account (`checkSetAllowed`, an explicit second check after the ACL), so a button there
 * could only ever fail -- the legacy app hides it for the same reason.
 *
 * **Deleting is offered on every row, the reader's own included**, which is the legacy behaviour
 * and core-api's rule as written: `checkDelete` has no self-exemption. The confirmation names the
 * person, which is what makes the reader's own row look different from the others at the moment it
 * matters.
 */
export function UserRowActions({
  userId,
  fullName,
  isAllowed,
  isSelf,
}: {
  userId: string;
  fullName: string;
  isAllowed: boolean;
  isSelf: boolean;
}) {
  const t = useTranslations("Users.actions");
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState<"allowed" | "delete" | null>(null);
  const [pending, setPending] = useState(false);

  async function toggleAllowed() {
    setPending(true);
    const result = await setUserAllowed(userId, !isAllowed);
    setPending(false);
    if (!result.success) {
      toast.error(t(isAllowed ? "disableFailed" : "enableFailed"), result.formError);
      return;
    }
    setConfirming(null);
    toast.success(t(isAllowed ? "disabled" : "enabled", { name: fullName }));
    router.refresh();
  }

  async function remove() {
    setPending(true);
    const result = await deleteUserAccount(userId);
    setPending(false);
    if (!result.success) {
      toast.error(t("deleteFailed"), result.formError);
      return;
    }
    setConfirming(null);
    toast.success(t("deleted", { name: fullName }));
    router.refresh();
  }

  const button =
    "rounded-md border border-input px-2 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

  return (
    <span className="inline-flex flex-wrap justify-end gap-1">
      {!isSelf && (
        <button type="button" className={button} onClick={() => setConfirming("allowed")}>
          {isAllowed ? t("disable") : t("enable")}
        </button>
      )}
      <button
        type="button"
        className={`${button} text-destructive`}
        onClick={() => setConfirming("delete")}
      >
        {t("delete")}
      </button>

      <ConfirmDialog
        open={confirming === "allowed"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={t(isAllowed ? "disable" : "enable")}
        description={t(isAllowed ? "confirmDisable" : "confirmEnable", { name: fullName })}
        confirmLabel={t(isAllowed ? "disable" : "enable")}
        destructive={isAllowed}
        pending={pending}
        onConfirm={() => void toggleAllowed()}
      />

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={t("delete")}
        description={t(isSelf ? "confirmDeleteSelf" : "confirmDelete", { name: fullName })}
        confirmLabel={t("delete")}
        pending={pending}
        onConfirm={() => void remove()}
      />
    </span>
  );
}
