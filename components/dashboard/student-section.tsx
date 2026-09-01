import { getLocale, getTranslations } from "next-intl/server";

import { getStudentDashboard } from "@/lib/api/dashboard";

import { EmptyState } from "@/components/state/empty-state";

import { GroupProgressCards } from "./group-progress";
import { ShadowAssignments } from "./shadow-assignments";
import { UpcomingDeadlines } from "./upcoming-deadlines";

/**
 * The dashboard's student half (S-001). Fetches its own data rather than receiving it from the
 * page, which is what lets the page wrap it in a `Suspense` boundary and an `ErrorBoundary`: the
 * teacher half (S-002) is a separate fan-out over separate endpoints, and one of them failing or
 * being slow should not blank the other.
 *
 * `docs/IA.md` §4.1 wants every half visible at once ("No mode switch"), so these are stacked
 * sections rather than tabs; the page owns the "My studies" heading they sit under, and DEC-060
 * covers what became of the `?tab=` deep-link the same IA section describes.
 */
export async function StudentSection() {
  const locale = await getLocale();
  const [t, dashboard] = await Promise.all([
    getTranslations("Dashboard"),
    getStudentDashboard(locale),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="dashboard-upcoming">
        <h3 id="dashboard-upcoming" className="mb-3 text-base font-semibold tracking-tight">
          {t("upcoming.heading")}
        </h3>
        <UpcomingDeadlines
          assignments={dashboard.upcoming}
          empty={
            <EmptyState
              title={t("upcoming.emptyTitle")}
              description={t("upcoming.emptyDescription")}
              headingLevel={4}
            />
          }
        />
      </section>

      {dashboard.shadow.length > 0 && (
        <section aria-labelledby="dashboard-shadow">
          <h3 id="dashboard-shadow" className="mb-3 text-base font-semibold tracking-tight">
            {t("shadow.heading")}
          </h3>
          <ShadowAssignments assignments={dashboard.shadow} />
        </section>
      )}

      {dashboard.progress.length > 0 && (
        <section aria-labelledby="dashboard-progress">
          <h3 id="dashboard-progress" className="mb-3 text-base font-semibold tracking-tight">
            {t("progress.heading")}
          </h3>
          <GroupProgressCards groups={dashboard.progress} />
        </section>
      )}
    </div>
  );
}
