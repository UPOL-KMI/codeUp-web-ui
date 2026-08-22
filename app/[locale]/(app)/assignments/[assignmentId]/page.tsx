import { getLocale, getTranslations } from "next-intl/server";

import { PageShell } from "@/components/page-shell";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

// Route skeleton (F-013's pattern) for a destination the dashboard now links to, added for the
// same reason the group/exercise/user skeletons were: Next prefetches every visible <Link>, so a
// route that does not exist logs a 404 on the *linking* page. S-012 builds the real thing; the
// breadcrumb here is already real.
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const [locale, t] = await Promise.all([getLocale(), getTranslations("Placeholder")]);
  const breadcrumbs = await resolveBreadcrumbs(`/assignments/${assignmentId}`, locale);

  return (
    <PageShell title={breadcrumbs[breadcrumbs.length - 1]!.label} breadcrumbs={breadcrumbs}>
      <p className="text-muted-foreground">{t("comingSoon")}</p>
    </PageShell>
  );
}
