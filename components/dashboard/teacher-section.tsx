import { getLocale, getTranslations } from "next-intl/server";

import { getTeacherDashboard } from "@/lib/api/dashboard";

import { EmptyState } from "@/components/state/empty-state";

import { ReviewQueue } from "./review-queue";
import { UpcomingDeadlines } from "./upcoming-deadlines";

/**
 * The dashboard's teacher half (S-002): what needs attention, what students are waiting for, and
 * what is coming up. Fetches its own data for the same reason the student half does -- the page
 * wraps each half in its own `Suspense` and `ErrorBoundary`, so a slow or failing review queue
 * cannot blank a student's deadlines.
 *
 * The two review panels are hidden when empty rather than showing an empty state each. An empty
 * state is for a list the reader expected to have contents; "no reviews are waiting" is the
 * normal, good state, and three empty boxes on the landing page would be noise. The deadlines
 * panel does get one, because a teacher whose groups have no upcoming deadlines is worth telling.
 */
export async function TeacherSection() {
  const locale = await getLocale();
  const [t, dashboard] = await Promise.all([
    getTranslations("Dashboard"),
    getTeacherDashboard(locale),
  ]);

  const columns = {
    student: t("reviews.columns.student"),
    assignment: t("upcoming.columns.assignment"),
    group: t("upcoming.columns.group"),
  };

  return (
    <div className="flex flex-col gap-8">
      {dashboard.pendingReviews.length > 0 && (
        <section aria-labelledby="dashboard-pending-reviews">
          <h3
            id="dashboard-pending-reviews"
            className="mb-3 text-base font-semibold tracking-tight"
          >
            {t("reviews.pendingHeading")}
          </h3>
          <ReviewQueue
            items={dashboard.pendingReviews}
            columns={{ ...columns, since: t("reviews.columns.opened") }}
          />
        </section>
      )}

      {dashboard.reviewRequests.length > 0 && (
        <section aria-labelledby="dashboard-review-requests">
          <h3
            id="dashboard-review-requests"
            className="mb-3 text-base font-semibold tracking-tight"
          >
            {t("reviews.requestedHeading")}
          </h3>
          <ReviewQueue
            items={dashboard.reviewRequests}
            columns={{ ...columns, since: t("reviews.columns.submitted") }}
          />
        </section>
      )}

      <section aria-labelledby="dashboard-teaching-deadlines">
        <h3
          id="dashboard-teaching-deadlines"
          className="mb-3 text-base font-semibold tracking-tight"
        >
          {t("teaching.upcomingHeading")}
        </h3>
        <UpcomingDeadlines
          assignments={dashboard.upcoming}
          empty={
            <EmptyState
              title={t("teaching.emptyTitle")}
              description={t("teaching.emptyDescription")}
            />
          }
        />
      </section>
    </div>
  );
}
