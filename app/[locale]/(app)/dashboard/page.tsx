import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { getMyGroups } from "@/lib/api/groups";
import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { CalendarSection } from "@/components/dashboard/calendar-section";
import { SectionNav, type SectionNavItem } from "@/components/dashboard/section-nav";
import { StudentSection } from "@/components/dashboard/student-section";
import { TeacherSection } from "@/components/dashboard/teacher-section";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorBoundary } from "@/components/state/error-boundary";
import { TableSkeleton } from "@/components/state/skeleton";

/**
 * The authenticated landing page (`docs/IA.md` §4.1: "a landing pad, not a destination").
 *
 * Which sections appear is decided by **per-group membership**, not by the global role -- the same
 * rule the sidebar follows (D-014), and the reason a supervisor-student sees every half rather
 * than having to pick a mode. Each fetches its own data behind its own boundary, so one of them
 * failing or being slow does not take the others down with it.
 *
 * `?tab=` renders the named section **first** rather than scrolling to it or hiding the others
 * (DEC-060). A cold deep-link therefore lands on what it asked for with no JavaScript and no
 * scrolling, which is the only version of this that survives the sections above it streaming in
 * afterwards -- measured, not assumed: both a `#fragment` and a scroll-on-mount effect end up back
 * at the top of the page once the suspended sections resolve and push the target down.
 */
interface DashboardSearchParams {
  tab?: string;
  month?: string;
}

interface DashboardSection extends SectionNavItem {
  tab: string;
  body: React.ReactNode;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const locale = await getLocale();
  const [breadcrumbs, t, groups, params] = await Promise.all([
    resolveBreadcrumbsForNamespace("Dashboard", locale),
    getTranslations("Dashboard"),
    getMyGroups(locale),
    searchParams,
  ]);

  const hasAnyGroup = groups.member.length > 0 || groups.teaching.length > 0;

  const sections: DashboardSection[] = [
    ...(groups.member.length > 0
      ? [
          {
            tab: "student",
            anchor: "dashboard-studies",
            label: t("studies.heading"),
            body: <StudentSection />,
          },
        ]
      : []),
    ...(groups.teaching.length > 0
      ? [
          {
            tab: "teacher",
            anchor: "dashboard-teaching",
            label: t("teaching.heading"),
            body: <TeacherSection />,
          },
        ]
      : []),
    ...(hasAnyGroup
      ? [
          {
            tab: "calendar",
            anchor: "dashboard-calendar",
            label: t("calendar.heading"),
            body: <CalendarSection monthParam={params.month} />,
          },
        ]
      : []),
  ];

  // Stable apart from the requested section moving to the front, so the order a reader without a
  // `?tab=` sees never shuffles.
  const ordered = [
    ...sections.filter((section) => section.tab === params.tab),
    ...sections.filter((section) => section.tab !== params.tab),
  ];

  return (
    <PageShell title={breadcrumbs[breadcrumbs.length - 1]!.label} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-10">
        <SectionNav items={ordered} label={t("nav.label")} />

        {ordered.map((section) => (
          <section key={section.tab} aria-labelledby={section.anchor}>
            <h2
              id={section.anchor}
              className="mb-3 scroll-mt-4 text-lg font-semibold tracking-tight"
            >
              {section.label}
            </h2>
            <ErrorBoundary>
              <Suspense fallback={<TableSkeleton />}>{section.body}</Suspense>
            </ErrorBoundary>
          </section>
        ))}

        {!hasAnyGroup && (
          <EmptyState title={t("noGroups.title")} description={t("noGroups.description")} />
        )}
      </div>
    </PageShell>
  );
}
