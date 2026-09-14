"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useApiErrorMessage, type ApiErrorBody } from "@/lib/api/use-api-error-message";
import { useRouter } from "@/i18n/navigation";
import { buttonClasses } from "@/components/button";

/**
 * Setting the password that finishes an emailed invitation (S-024).
 *
 * Posts to the auth BFF rather than to a Server Action, because accepting **signs the person in**
 * and every session-minting call in this app is a Route Handler under `app/api/auth/`. That is
 * also why this form is hand-rolled instead of using `useServerActionForm`: the form kit's
 * contract is a Server Action, and bending it around a `fetch` would hide the one thing worth
 * noticing about this screen.
 *
 * The two passwords are compared here *and* by core-api (`400-102`). The local check is not the
 * authority; it is what stops a typo from costing a round trip.
 *
 * **There is no consent tick** (DROP-C07). One stood here and on the registration form; it named
 * a GDPR policy this deployment does not publish, and core-api has no field to record an answer
 * in -- so it asked people to agree to a document they could not read and kept no evidence that
 * they had.
 */
export function AcceptInvitationForm({ token }: { token: string }) {
  const t = useTranslations("AcceptInvitation");
  const apiError = useApiErrorMessage();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input =
    "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== passwordConfirm) {
      setError(t("errors.mismatch"));
      return;
    }

    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/accept-invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, passwordConfirm }),
    });

    if (response.ok) {
      // The session cookie arrived on this response, so the RSC request this push makes already
      // carries it -- and `(app)`'s shell is below the common layout, so it renders fresh. Same
      // shape as S-022's sign-out after a password change.
      router.push("/dashboard");
      return;
    }

    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    setPending(false);
    setError(apiError(body.code, t("errors.failed")));
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("password")}</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={input}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("passwordConfirm")}</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={error === t("errors.mismatch") ? true : undefined}
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          className={input}
        />
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div>
        <button type="submit" disabled={pending} className={buttonClasses("primary", "sm")}>
          {pending ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}
