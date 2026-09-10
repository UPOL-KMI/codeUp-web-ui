"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { safeRedirectTarget } from "@/lib/auth/redirect-target";

import { useRouter } from "@/i18n/navigation";

/**
 * Signing in (A-002).
 *
 * **It posts to the Auth BFF Route Handler, not to a Server Action** (brief §5): the whole point
 * of that route is that it receives the credentials, calls core-api and sets the httpOnly cookie
 * -- a Server Action could do the first two and not the third in a way this app wants to rely on,
 * and the route already exists and is what every other entry point (the external-auth callback,
 * the e2e helper) uses. So this component is a plain form with `fetch`, not the form kit's
 * `useServerActionForm`.
 *
 * `router.refresh()` before navigating: the app shell is a Server Component that reads the session,
 * and pushing without refreshing would render the next page from a tree that still believes nobody
 * is signed in.
 *
 * The password field is a real `type="password"` with `autoComplete` set, so a password manager
 * recognises the form -- and nothing here ever puts the password anywhere but the request body.
 */
export function LoginForm({
  from,
  shortSessionMinutes,
}: {
  from?: string;
  /** Present only where the deployment configures one; the legacy app hides the choice too. */
  shortSessionMinutes: number | null;
}) {
  const t = useTranslations("Login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [short, setShort] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, short }),
    }).catch(() => null);

    if (!response || !response.ok) {
      setPending(false);
      // core-api's own message where there is one ("Invalid credentials", an account that has been
      // disabled, ...), because it says more than a generic sentence can.
      const body = (await response?.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? t("errors.failed"));
      return;
    }

    // G-022: the reader's stored "default page (after login)", which the BFF route reads out of
    // core-api's own login response. `?from=` still wins -- `safeRedirectTarget` prefers it and
    // falls back to this.
    const body = (await response.json().catch(() => null)) as { defaultPage?: string } | null;
    router.refresh();
    router.push(safeRedirectTarget(from, body?.defaultPage ?? "/dashboard"));
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
          className={input}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t("password")}
        <input
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className={input}
        />
      </label>

      {shortSessionMinutes !== null && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={short}
            onChange={(event) => setShort(event.target.checked)}
          />
          <span className="flex flex-col gap-0.5">
            <span>{t("shortSession", { minutes: shortSessionMinutes })}</span>
            <span className="text-xs text-muted-foreground">{t("shortSessionHint")}</span>
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        {pending ? t("signingIn") : t("signIn")}
      </button>
    </form>
  );
}
