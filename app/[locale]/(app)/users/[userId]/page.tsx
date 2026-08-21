import { getLocale, getTranslations } from "next-intl/server";

import { PageShell } from "@/components/page-shell";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

// Route skeleton (F-013's pattern) for a destination the sidebar and command palette now link to.
// It exists because linking to a route that does not exist is not a neutral omission: Next
// prefetches every visible <Link>, so an absent route logs a 404 on the *linking* page -- which is
// how this gap was found, via the smoke suite's console-error check on a seeded student's
// dashboard. The breadcrumb is real (it fetches the entity's name); only the body is a stub.
export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [locale, t] = await Promise.all([getLocale(), getTranslations("Placeholder")]);
  const breadcrumbs = await resolveBreadcrumbs(`/users/${userId}`, locale);

  return (
    <PageShell title={breadcrumbs[breadcrumbs.length - 1]!.label} breadcrumbs={breadcrumbs}>
      <p className="text-muted-foreground">{t("comingSoon")}</p>
    </PageShell>
  );
}
