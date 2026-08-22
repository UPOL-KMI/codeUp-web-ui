import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { getMyGroups } from "@/lib/api/groups";
import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { StudentSection } from "@/components/dashboard/student-section";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorBoundary } from "@/components/state/error-boundary";
import { TableSkeleton } from "@/components/state/skeleton";

/**
 * The authenticated landing page (`docs/IA.md` §4.1: "a landing pad, not a destination").
 *
 * Which sections appear is decided by **per-group membership**, not by the global role -- the same
 * rule the sidebar follows (D-014), and the reason a supervisor-student sees both halves rather
 * than having to pick a mode. S-001 builds the student half; the teacher half (S-002) and the
 * calendar (S-003) fill the remaining slots.
 */
export default async function DashboardPage() {
  const locale = await getLocale();
  const [breadcrumbs, t, groups] = await Promise.all([
    resolveBreadcrumbsForNamespace("Dashboard", locale),
    getTranslations("Dashboard"),
    getMyGroups(locale),
  ]);

  const hasAnyGroup = groups.member.length > 0 || groups.teaching.length > 0;

  return (
    <PageShell title={breadcrumbs[breadcrumbs.length - 1]!.label} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-10">
        {groups.member.length > 0 && (
          <ErrorBoundary>
            <Suspense fallback={<TableSkeleton />}>
              <StudentSection />
            </Suspense>
          </ErrorBoundary>
        )}

        {groups.teaching.length > 0 && (
          <section aria-labelledby="dashboard-teaching">
            <h2 id="dashboard-teaching" className="mb-3 text-lg font-semibold tracking-tight">
              {t("teaching.heading")}
            </h2>
            <p className="text-muted-foreground">{t("teaching.comingSoon")}</p>
          </section>
        )}

        {!hasAnyGroup && (
          <EmptyState title={t("noGroups.title")} description={t("noGroups.description")} />
        )}
      </div>
    </PageShell>
  );
}
