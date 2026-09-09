import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getPublicInstances } from "@/lib/api/instances";
import { localRegistrationEnabled } from "@/lib/auth/registration";

import { Link } from "@/i18n/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { RouteMessages } from "@/components/route-messages";

/**
 * Creating an account (A-003).
 *
 * **Whether this page has a form on it is a deployment's choice**, and core-api publishes no way
 * to ask -- so this app carries the same switch the legacy frontend does
 * (`ALLOW_LOCAL_REGISTRATION`, mirroring core-api's `localRegistration.enabled`). On this
 * deployment it is off, and the page says so instead of offering a form that core-api would
 * refuse: an instance that authenticates through CAS has no use for one, and a form that always
 * fails is worse than an explanation.
 *
 * The instances come from `/v1/instances`, which is public -- an account belongs to one, and where
 * a deployment runs several the reader has to say which.
 */
/**
 * Rendered per request, not prerendered: what this page shows depends on
 * `ALLOW_LOCAL_REGISTRATION`, which is read at run time and can differ between the machine that
 * built the image and the one running it. Without this, the build baked in whichever answer the
 * builder had -- found live, by turning the flag on and getting the closed page anyway.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Register" });
  return { title: t("title") };
}

export default async function RegisterPage() {
  const t = await getTranslations("Register");
  const enabled = localRegistrationEnabled();

  const instances = enabled ? await getPublicInstances() : [];

  return (
    <RouteMessages>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {enabled ? t("explain") : t("closedShort")}
          </p>
        </div>

        {enabled ? (
          <RegisterForm instances={instances} />
        ) : (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">{t("closed")}</p>
        )}

        <p className="text-sm">
          <Link
            href="/login"
            className="text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("haveAccount")}
          </Link>
        </p>
      </div>
    </RouteMessages>
  );
}
