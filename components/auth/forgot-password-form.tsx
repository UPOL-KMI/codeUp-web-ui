"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Asking for a password-reset email (A-004).
 *
 * **The success state does not say whether the address exists**, because the route behind it does
 * not know how to tell you and should not: a reset form that answers differently for a known and
 * an unknown address is a way to enumerate accounts. "If we know that address, a message is on its
 * way" is both true and all anybody needs.
 */
export function ForgotPasswordForm() {
  const t = useTranslations("ForgotPassword");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/auth/forgotten-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);

    setPending(false);
    if (!response || !response.ok) {
      setError(t("errors.failed"));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="rounded-lg border border-success bg-success/10 p-3 text-sm">
        {t("sent", { email })}
      </p>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        {t("email")}
        <input
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          autoFocus
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        {pending ? t("sending") : t("send")}
      </button>
    </form>
  );
}
