"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { deleteInstance, setInstanceOpen } from "@/lib/actions/instances";
import type { Instance } from "@/lib/api/instances";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";

/**
 * The two things `POST /v1/instances/{id}` and its sibling can do (AD-005).
 *
 * **There is exactly one setting**, and that is core-api's doing rather than a narrow reading of
 * the ticket: the update endpoint's whole request body is `{isOpen}`. The name and description
 * live on the instance's root group, which is why the screen around this points at that group
 * instead of offering fields it could not save.
 *
 * Deleting is here rather than on the list, where a row-level delete among several instances is a
 * misclick with no undo -- and the confirmation names what actually goes, which is **less** than
 * anybody would assume: core-api removes the instance row and leaves the root group standing
 * (Q-023).
 */
export function InstanceSettings({
  instance,
  deletable,
}: {
  instance: Instance;
  /** False for the instance the reader's own account belongs to. */
  deletable: boolean;
}) {
  const t = useTranslations("Instances.settings");
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState<"open" | "delete" | null>(null);
  const [pending, setPending] = useState(false);

  async function toggleOpen() {
    setPending(true);
    const result = await setInstanceOpen(instance.id, !instance.isOpen);
    setPending(false);
    if (!result.success) {
      toast.error(t("updateFailed"), result.formError);
      return;
    }
    setConfirming(null);
    toast.success(t(instance.isOpen ? "closed" : "opened"));
    router.refresh();
  }

  async function remove() {
    setPending(true);
    const result = await deleteInstance(instance.id);
    setPending(false);
    if (!result.success) {
      toast.error(t("deleteFailed"), result.formError);
      return;
    }
    toast.success(t("deleted", { name: instance.name }));
    router.push("/admin/instances");
  }

  const button =
    "rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {instance.isOpen ? t("stateOpen") : t("stateClosed")}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => setConfirming("open")}>
          {instance.isOpen ? t("close") : t("open")}
        </button>
        {deletable && (
          <button
            type="button"
            className={`${button} text-destructive`}
            onClick={() => setConfirming("delete")}
          >
            {t("delete")}
          </button>
        )}
      </div>
      {!deletable && <p className="text-xs text-muted-foreground">{t("cannotDeleteOwn")}</p>}

      <ConfirmDialog
        open={confirming === "open"}
        onOpenChange={(next) => !next && setConfirming(null)}
        title={instance.isOpen ? t("close") : t("open")}
        description={instance.isOpen ? t("confirmClose") : t("confirmOpen")}
        confirmLabel={instance.isOpen ? t("close") : t("open")}
        destructive={instance.isOpen}
        pending={pending}
        onConfirm={() => void toggleOpen()}
      />

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(next) => !next && setConfirming(null)}
        title={t("delete")}
        description={t("confirmDelete", { name: instance.name })}
        confirmLabel={t("delete")}
        pending={pending}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
