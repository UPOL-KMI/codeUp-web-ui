import { getLocale, getTranslations } from "next-intl/server";

import { decodeInvitationToken } from "@/lib/auth/invitation-token";
import { readQueryToken } from "@/lib/auth/query-token";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { DateTime } from "@/components/format/date-time";
import { RelativeTime } from "@/components/format/relative-time";
import { PageShell } from "@/components/page-shell";
import { AcceptInvitationForm } from "@/components/users/accept-invitation-form";

/**
 * Finishing an invitation that arrived by email (S-024): the one screen in the product where an
 * account is created for someone who has never signed in.
 *
 * **The token is the whole query string**, not a named parameter -- core-api builds the link from
 * `invitationUrl: "%webapp.address%/accept-invitation?{token}"` (`app/config/config.neon`), so
 * what arrives is `?eyJhbGciOi...` with no key. `readQueryToken` handles that (and a deployment
 * that overrides the template to name it); it lives in `lib/auth/` because A-005's password-reset
 * link arrives exactly the same way.
 *
 * Everything shown here comes out of the token itself, decoded on the server -- there is no
 * session yet, so there is no endpoint to ask. What the reader supplies is a password; core-api
 * then verifies the signature it wrote, creates the account, and returns a token that
 * `/api/auth/accept-invitation` turns into a session.
 */
export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, locale] = await Promise.all([searchParams, getLocale()]);
  const [t, breadcrumbs] = await Promise.all([
    getTranslations("AcceptInvitation"),
    resolveBreadcrumbs("/accept-invitation", locale),
  ]);

  const rawToken = readQueryToken(params);
  const claims = rawToken ? decodeInvitationToken(rawToken) : null;
  const fullName = claims
    ? [claims.titlesBeforeName, claims.firstName, claims.lastName, claims.titlesAfterName]
        .filter((part) => part !== "")
        .join(" ")
    : "";

  return (
    <PageShell title={t("title")} breadcrumbs={breadcrumbs}>
      {!claims ? (
        <p className="max-w-2xl rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("unreadableToken")}
        </p>
      ) : (
        <div className="flex max-w-2xl flex-col gap-8">
          <p className="text-sm text-muted-foreground">{t("welcome")}</p>

          <section aria-labelledby="invitation-details">
            <h2 id="invitation-details" className="mb-3 text-base font-semibold tracking-tight">
              {t("details")}
            </h2>
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              <div className="flex justify-between gap-4 border-b border-border py-2 sm:col-span-2">
                <dt className="shrink-0 text-sm text-muted-foreground">{t("invitedPerson")}</dt>
                <dd className="text-sm">{fullName || claims.email}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border py-2 sm:col-span-2">
                <dt className="shrink-0 text-sm text-muted-foreground">{t("email")}</dt>
                <dd className="text-sm">
                  <code className="text-xs">{claims.email}</code>
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border py-2">
                <dt className="shrink-0 text-sm text-muted-foreground">{t("issuedAt")}</dt>
                <dd className="text-sm">
                  <DateTime unixSeconds={claims.issuedAt} />
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border py-2">
                <dt className="shrink-0 text-sm text-muted-foreground">{t("expiresAt")}</dt>
                <dd className="text-sm">
                  <span className="flex flex-col items-end">
                    <DateTime unixSeconds={claims.expiresAt} />
                    <span className="text-xs text-muted-foreground">
                      <RelativeTime unixSeconds={claims.expiresAt} />
                    </span>
                  </span>
                </dd>
              </div>
            </dl>
            {claims.groupCount > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("groupCount", { count: claims.groupCount })}
              </p>
            )}
          </section>

          <section aria-labelledby="invitation-password">
            <h2 id="invitation-password" className="mb-3 text-base font-semibold tracking-tight">
              {t("choosePassword")}
            </h2>
            {claims.hasExpired ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {t("expired")}
              </p>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">{t("passwordHint")}</p>
                <AcceptInvitationForm token={rawToken!} />
              </>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
