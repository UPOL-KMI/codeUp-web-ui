"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

/**
 * Setting a new password from the link in the email (A-005).
 *
 * **The token is never shown and never stored** -- it arrives in the URL, is held in this
 * component's props for the one request that uses it, and is dead the moment core-api accepts the
 * change (it sets the user's token validity threshold, which invalidates every token they hold,
 * this one included). So the reader is sent to sign in afterwards rather than being signed in
 * here: there is nothing left to sign them in with, and that is the correct behaviour, not a
 * shortcoming.
 *
 * The strength meter is core-api's own zxcvbn score, asked for on a debounce. **Zero is refused**,
 * the way the legacy form refuses it; one to four are drawn and none of them blocks anything --
 * this is advice, and the authority on what is acceptable stays with core-api.
 */
const STRENGTH_TONES = [
  "bg-destructive",
  "bg-destructive",
  "bg-warning",
  "bg-success",
  "bg-success",
];

export function ChangePasswordForm({ token }: { token: string }) {
  const t = useTranslations("ForgotPasswordChange");
  const router = useRouter();
  const strengthId = useId();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No `setState` on the empty-field path: the meter is simply not rendered without a password,
    // so there is nothing to clear -- and clearing it here is what `react-hooks/set-state-in-effect`
    // exists to catch (an extra render pass for a value the render already knows).
    if (password === "") return;
    const timeout = setTimeout(() => {
      void fetch("/api/auth/password-strength", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { score?: number | null } | null) => setScore(body?.score ?? null))
        .catch(() => setScore(null));
    }, 400);
    return () => clearTimeout(timeout);
  }, [password]);

  const mismatched = confirmation !== "" && confirmation !== password;
  const tooWeak = score === 0;
  const blocked = pending || mismatched || tooWeak || password === "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked) return;
    setPending(true);
    setError(null);

    const response = await fetch("/api/auth/forgotten-password/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    }).catch(() => null);

    if (!response || !response.ok) {
      setPending(false);
      const body = (await response?.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? t("errors.failed"));
      return;
    }

    // Nothing here can sign the reader in: core-api has just invalidated every token they had.
    router.push("/login?passwordChanged=1");
  }

  const input =
    "rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

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

      <div className="flex flex-col gap-1">
        <label className="flex flex-col gap-1 text-sm">
          {t("password")}
          <input
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            autoFocus
            aria-describedby={strengthId}
            className={input}
          />
        </label>

        {password !== "" && score !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className={`h-full ${STRENGTH_TONES[score] ?? "bg-muted"}`}
              style={{ width: `${((score + 1) / 5) * 100}%` }}
            />
          </div>
        )}
        <p
          id={strengthId}
          role="status"
          className={`text-xs ${tooWeak ? "text-destructive" : "text-muted-foreground"}`}
        >
          {password !== "" && score !== null ? t(`strength.${score}`) : ""}
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        {t("confirmation")}
        <input
          type="password"
          name="confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="new-password"
          required
          aria-invalid={mismatched}
          className={input}
        />
        {mismatched && (
          <span role="alert" className="text-xs text-destructive">
            {t("errors.mismatch")}
          </span>
        )}
      </label>

      <button
        type="submit"
        aria-disabled={blocked}
        aria-describedby={strengthId}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-disabled:opacity-60"
      >
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
