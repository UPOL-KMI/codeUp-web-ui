"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Signing in as somebody else (AD-003), on the profile of the person being become.
 *
 * **This is a login, not a mode.** core-api's `actionTakeOver` issues an ordinary master+refresh
 * token for the target and nothing else -- no claim saying whose doing it was, no marker this app
 * could read afterwards. So there is no "you are impersonating X" banner to render and no way
 * back but signing out and signing in again, which is exactly what the legacy app does and what
 * the confirmation says in as many words (DEC-112).
 *
 * **It lands with a full page load, not a client navigation.** The session cookie now belongs to a
 * different person, and Next's client-side Router Cache still holds RSC payloads rendered for the
 * administrator; pushing a route would show some of them. Every read in this app is `no-store`
 * server-side (DEC-021) precisely so one user's data cannot reach another, and throwing the whole
 * client away is the one-line way to keep that true on this side too.
 *
 * Offered only where core-api would accept it: a superadmin, never on oneself, and never on a
 * disabled account -- that last one is not an ACL rule but a pointless outcome, since every call
 * the resulting session made would be refused.
 */
export function TakeoverButton({ userId, fullName }: { userId: string; fullName: string }) {
  const t = useTranslations("Profile.takeover");
  const locale = useLocale();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function takeOver() {
    setPending(true);
    const response = await fetch(`/api/auth/takeover/${userId}`, { method: "POST" }).catch(
      () => null,
    );
    const body = (await response?.json().catch(() => null)) as { message?: string } | null;

    if (!response?.ok) {
      setPending(false);
      toast.error(t("failed"), body?.message);
      return;
    }

    // The rule below advises `router.push`, which is right for every navigation but this one: the
    // session cookie now identifies a different person, and a client navigation would reuse a
    // Router Cache full of payloads rendered for the administrator.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/${locale}/dashboard`;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {t("action")}
      </button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title={t("action")}
        description={t("confirm", { name: fullName })}
        confirmLabel={t("action")}
        destructive={false}
        pending={pending}
        onConfirm={() => void takeOver()}
      />
    </>
  );
}
