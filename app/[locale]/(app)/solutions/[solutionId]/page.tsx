import { getLocale, getTranslations } from "next-intl/server";

import { PageShell } from "@/components/page-shell";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

// Route skeleton (F-013's pattern) for the destination the teacher dashboard's review queues link
// to, added for the same reason as `/assignments/[assignmentId]`: Next prefetches every visible
// <Link>, so a route that does not exist logs a 404 on the linking page. S-015 through S-018 build
// the real screen -- evaluation, sources, review comments; the breadcrumb here is already real.
export default async function Page({ params }: { params: Promise<{ solutionId: string }> }) {
  const { solutionId } = await params;
  const [locale, t] = await Promise.all([getLocale(), getTranslations("Placeholder")]);
  const breadcrumbs = await resolveBreadcrumbs(`/solutions/${solutionId}`, locale);

  return (
    <PageShell title={breadcrumbs[breadcrumbs.length - 1]!.label} breadcrumbs={breadcrumbs}>
      <p className="text-muted-foreground">{t("comingSoon")}</p>
    </PageShell>
  );
}
