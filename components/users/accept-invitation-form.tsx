"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { ConsentCheckbox } from "@/components/auth/consent-checkbox";
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
 * **The consent tick is asked here as well as on the registration form, which the legacy app does
 * not do** (G-026, DEC-129). This submit is what creates the account:
 * `RegistrationPresenter::actionAcceptInvitation` looks the address up and, finding no login,
 * builds the `User` entity on the spot. The teacher who sent the invitation typed the name; the
 * person reading this page is the one whose data it is, and this screen is the first time they are
 * asked anything at all. Where a login already exists the call only signs them in and enrols them,
 * and this page cannot tell the two apart -- so the tick is asked of a returning reader too, which
 * is the cheaper of the two mistakes.
 */
export function AcceptInvitationForm({ token }: { token: string }) {
  const t = useTranslations("AcceptInvitation");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
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
    if (!consent) {
      setConsentMissing(true);
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

    const body = (await response.json().catch(() => ({}))) as { message?: string };
    setPending(false);
    setError(body.message ?? t("errors.failed"));
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

      <ConsentCheckbox
        checked={consent}
        onChange={(value) => {
          setConsent(value);
          if (value) setConsentMissing(false);
        }}
        error={consentMissing}
      />

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
