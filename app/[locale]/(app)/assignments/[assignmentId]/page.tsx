import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getAssignmentDetail } from "@/lib/api/assignment";
import { getAssignmentSolverSummary } from "@/lib/api/assignment-solvers";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { AssignmentDetailView } from "@/components/assignments/assignment-detail";
import { ClassProgress } from "@/components/assignments/class-progress";
import { ExerciseSyncNotice } from "@/components/assignments/exercise-sync-notice";
import { PageShell } from "@/components/page-shell";
import { Discussion } from "@/components/comments/discussion";
import { ErrorBoundary } from "@/components/state/error-boundary";
import { TableSkeleton } from "@/components/state/skeleton";
import { Badge } from "@/components/status/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Assignment" });
  return { title: t("title") };
}

/**
 * An assignment (S-012) -- the destination every deadline row on the dashboard and in a group has
 * been linking to since S-001 -- and, for whoever set it, how the group is doing on it (S-013).
 *
 * The two audiences share one page, as `docs/IA.md` §4.3 lays it out ("same as student, plus"),
 * and each addition is gated on core-api's own hint rather than on a role: `viewAssignmentSolutions`
 * for the class progress, `update` for the terms only its author needs. Of the **links** §4.3 also
 * lists are both here now: "all submissions" (T-003) on the same hint the class progress uses, and
 * "edit assignment" (T-002) on `update`.
 */
export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const [{ assignmentId }, locale] = await Promise.all([params, getLocale()]);
  const [t, tComments, status, assignment] = await Promise.all([
    getTranslations("Assignment"),
    getTranslations("Comments"),
    getTranslations("Status"),
    getAssignmentDetail(assignmentId, locale),
  ]);
  const breadcrumbs = await resolveBreadcrumbs(`/assignments/${assignmentId}`, locale);

  return (
    <PageShell
      title={assignment.name}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {assignment.isBonus && <Badge tone="info">{t("badges.bonus")}</Badge>}
          {assignment.isExam && <Badge tone="warning">{t("badges.exam")}</Badge>}
          {!assignment.isPublic && <Badge>{t("badges.hidden")}</Badge>}
          {assignment.can.update && (
            <Link
              href={`/assignments/${assignmentId}/edit`}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("editAssignment")}
            </Link>
          )}
          {assignment.can.viewAssignmentSolutions && (
            <Link
              href={`/assignments/${assignmentId}/solutions`}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("allSolutions")}
            </Link>
          )}
          {assignment.groupId && (
            <Link
              href={`/groups/${assignment.groupId}?tab=assignments`}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("backToGroup")}
            </Link>
          )}
        </div>
      }
      subtitle={assignment.groupName || undefined}
    >
      <div className="flex flex-col gap-8">
        <ExerciseSyncNotice assignment={assignment} />
        <AssignmentDetailView assignment={assignment} />
        {/* The hint decides *whether* this section exists, above the boundary; only its fetch
            streams. Moving the gate below it would mean claiming the reader may see this before
            knowing that they may. */}
        {assignment.can.viewAssignmentSolutions && assignment.groupId && (
          <ErrorBoundary>
            <Suspense fallback={<TableSkeleton label={status("loading")} />}>
              <ClassProgressSection
                assignmentId={assignmentId}
                groupId={assignment.groupId}
                maxPoints={assignment.maxPointsFirst}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        <ErrorBoundary>
          <Suspense fallback={<TableSkeleton label={status("loading")} />}>
            <Discussion
              threadId={assignmentId}
              publicMeans={tComments("audience.assignment")}
              canModerate={assignment.can.update === true}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    </PageShell>
  );
}

/**
 * The class progress (S-013), reading its own summary so that the whole-group roster behind it
 * holds back only this section rather than every byte of the page.
 */
async function ClassProgressSection({
  assignmentId,
  groupId,
  maxPoints,
}: {
  assignmentId: string;
  groupId: string;
  maxPoints: number;
}) {
  const { solvers, summary } = await getAssignmentSolverSummary(assignmentId, groupId, maxPoints);

  return <ClassProgress assignmentId={assignmentId} solvers={solvers} summary={summary} />;
}
