"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/button";

/**
 * The nudge a reader with an unconfirmed address sees, and the button that sends the message again
 * (A-006) -- the legacy dashboard's `NotVerifiedEmailCallout`, which the backlog put on this
 * ticket.
 *
 * It states what an unconfirmed address actually costs: ReCodEx keeps sending mail there, so a
 * wrong address means silence rather than a locked account. Nothing in the product is withheld
 * for it, and saying otherwise would be inventing a rule core-api does not have.
 */
export function ResendVerification() {
  const t = useTranslations("EmailVerification.callout");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/email-verification/resend", { method: "POST" }).catch(
      () => null,
    );
    setPending(false);
    if (!response || !response.ok) {
      const body = (await response?.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? t("failed"));
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning bg-warning/10 p-4 text-sm">
      <p>{sent ? t("sent") : error ? error : t("explain")}</p>
      {!sent && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void resend()}
          className={buttonClasses("outline", "sm")}
        >
          {pending ? t("sending") : t("resend")}
        </button>
      )}
    </div>
  );
}
