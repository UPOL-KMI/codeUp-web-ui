import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { readQueryToken } from "@/lib/auth/query-token";

import { Link } from "@/i18n/navigation";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { RouteMessages } from "@/components/route-messages";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ForgotPasswordChange" });
  return { title: t("title") };
}

/**
 * Choosing a new password, from the link in the email (A-005).
 *
 * **The token is the whole query string** -- core-api's own link template is
 * `"%webapp.address%/forgotten-password/change?{token}"` -- so it is read with `readQueryToken`,
 * the same function S-024's invitation page uses. Note the *path* in that template is not this
 * app's: `app/[locale]/(anon)/forgotten-password/change/page.tsx` exists to redirect it here, so a
 * deployment does not have to reconfigure core-api's `linkTemplates` for its own emails to work
 * (DEC-100).
 *
 * Nothing here validates the token. It is signed with a key only core-api holds (DEC-085's rule
 * for the invitation token, and the same one), so the honest thing this app can do is take the
 * password, present the token, and show whatever core-api answers -- an expired link and a wrong
 * scope are different sentences, and they are core-api's to write.
 */
export default async function ForgotPasswordChangePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, t] = await Promise.all([searchParams, getTranslations("ForgotPasswordChange")]);
  const token = readQueryToken(params);

  return (
    <RouteMessages>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-16">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("explain")}</p>
        </div>

        {token === null ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {t("noToken")}
            </p>
            <p className="text-sm">
              <Link
                href="/forgot-password"
                className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t("askAgain")}
              </Link>
            </p>
          </div>
        ) : (
          <ChangePasswordForm token={token} />
        )}
      </div>
    </RouteMessages>
  );
}
