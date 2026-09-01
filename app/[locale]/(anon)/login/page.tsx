import { getTranslations } from "next-intl/server";

import { shortSessionSeconds } from "@/lib/auth/short-session";

import { Link } from "@/i18n/navigation";
import { LoginForm } from "@/components/auth/login-form";

/**
 * Signing in (A-002) -- the app's front door, and until now a `PlaceholderPage` in front of a real
 * BFF route that only the e2e suite ever called.
 *
 * Three things reach this page from elsewhere and each says why the reader is here: `?from=`,
 * which `proxy.ts` writes when it refuses a page to somebody without a session;
 * `?externalAuthError=1`, which the external-auth callback redirects to when a token is missing or
 * refused (F-019); and nothing at all, which is somebody signing in on purpose.
 *
 * **A visitor who already has a session never sees this**: `proxy.ts` sends them to the dashboard,
 * which is why there is no "you are already signed in" branch here, unlike the legacy page.
 *
 * External sign-in is **not offered**, because this deployment configures none -- no
 * authenticator name, no shared secret (Q-004). The callback route exists and its error is
 * rendered; the button that would start such a flow belongs with A-007, when there is a provider
 * to point it at.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; externalAuthError?: string; passwordChanged?: string }>;
}) {
  const [query, t] = await Promise.all([searchParams, getTranslations("Login")]);
  const shortSession = shortSessionSeconds();

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {query.from && (
        <p className="rounded-lg border border-warning bg-warning/10 p-3 text-sm">
          {t("signInRequired")}
        </p>
      )}

      {query.passwordChanged && (
        <p className="rounded-lg border border-success bg-success/10 p-3 text-sm">
          {t("passwordChanged")}
        </p>
      )}

      {query.externalAuthError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
        >
          {t("externalAuthFailed")}
        </p>
      )}

      <LoginForm
        from={query.from}
        shortSessionMinutes={shortSession === null ? null : Math.round(shortSession / 60)}
      />

      <p className="text-sm">
        <Link
          href="/forgot-password"
          className="text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("forgotPassword")}
        </Link>
      </p>
    </div>
  );
}
