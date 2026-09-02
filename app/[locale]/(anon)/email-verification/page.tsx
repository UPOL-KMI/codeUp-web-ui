import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { readQueryToken } from "@/lib/auth/query-token";

import { Link } from "@/i18n/navigation";
import { VerifyEmail } from "@/components/auth/verify-email";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "EmailVerification" });
  return { title: t("title") };
}

/**
 * Confirming an email address (A-006) -- where the link in ReCodEx's own verification message
 * lands.
 *
 * core-api builds it as `"%webapp.address%/email-verification?{token}"`, which is this route
 * exactly, so nothing has to forward it the way A-005's link does (DEC-100). **The token is the
 * whole query string** again, read by the same `readQueryToken`.
 *
 * Public, and deliberately: the link is opened from an inbox, quite possibly in a browser with no
 * session and quite possibly not the one the account was created in.
 */
export default async function EmailVerificationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, t] = await Promise.all([searchParams, getTranslations("EmailVerification")]);
  const token = readQueryToken(params);

  return (
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
              href="/login"
              className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("toLogin")}
            </Link>
          </p>
        </div>
      ) : (
        <VerifyEmail token={token} />
      )}
    </div>
  );
}
