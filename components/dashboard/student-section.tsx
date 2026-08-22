import { getLocale, getTranslations } from "next-intl/server";

import { getStudentDashboard } from "@/lib/api/dashboard";

import { GroupProgressCards } from "./group-progress";
import { UpcomingDeadlines } from "./upcoming-deadlines";

/**
 * The dashboard's student half (S-001). Fetches its own data rather than receiving it from the
 * page, which is what lets the page wrap it in a `Suspense` boundary and an `ErrorBoundary`: the
 * teacher half (S-002) is a separate fan-out over separate endpoints, and one of them failing or
 * being slow should not blank the other.
 *
 * `docs/IA.md` §4.1 wants both halves visible at once ("No mode switch"), so these are stacked
 * sections rather than tabs -- see DEC-057 for what becomes of the `?tab=` deep-link the same
 * section describes.
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
        <h2 id="dashboard-upcoming" className="mb-3 text-lg font-semibold tracking-tight">
          {t("upcoming.heading")}
        </h2>
        <UpcomingDeadlines assignments={dashboard.upcoming} />
      </section>

      {dashboard.progress.length > 0 && (
        <section aria-labelledby="dashboard-progress">
          <h2 id="dashboard-progress" className="mb-3 text-lg font-semibold tracking-tight">
            {t("progress.heading")}
          </h2>
          <GroupProgressCards groups={dashboard.progress} />
        </section>
      )}
    </div>
  );
}
