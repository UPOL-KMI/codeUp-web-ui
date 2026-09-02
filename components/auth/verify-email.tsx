"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/**
 * Confirming an email address from the link that was sent to it (A-006).
 *
 * **It asks for a click rather than verifying on load**, which the legacy page does not: the link
 * lands in an inbox, and mail clients, link scanners and prefetchers open links on their own. A
 * confirmation that happens because a scanner looked at the message is a confirmation nobody made.
 * One button, and the address is confirmed by the person who read the email.
 *
 * The token never becomes a session -- it carries the `email-verification` scope and is spent on
 * the single call behind this button.
 */
export function VerifyEmail({ token }: { token: string }) {
  const t = useTranslations("EmailVerification");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmation = useRef<HTMLDivElement>(null);

  // The button that was pressed is unmounted by the panel that replaces it, which would drop focus
  // to the document body -- so the panel takes it instead, and the next Tab is the dashboard link.
  useEffect(() => {
    if (done) confirmation.current?.focus();
  }, [done]);

  async function verify() {
    setPending(true);
    setError(null);

    const response = await fetch("/api/auth/email-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => null);

    setPending(false);
    if (!response || !response.ok) {
      const body = (await response?.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? t("errors.failed"));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div ref={confirmation} tabIndex={-1} className="flex flex-col gap-3 outline-none">
        <p className="rounded-lg border border-success bg-success/10 p-3 text-sm">{t("done")}</p>
        <p className="text-sm">
          <Link
            href="/dashboard"
            className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("toDashboard")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div>
        <button
          type="button"
          disabled={pending}
          onClick={() => void verify()}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          {pending ? t("verifying") : t("verify")}
        </button>
      </div>
    </div>
  );
}
