import { getLocale, getTranslations } from "next-intl/server";

import { getAssignmentDetail } from "@/lib/api/assignment";
import { getAssignmentSolverSummary } from "@/lib/api/assignment-solvers";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { AssignmentDetailView } from "@/components/assignments/assignment-detail";
import { ClassProgress } from "@/components/assignments/class-progress";
import { ExerciseSyncNotice } from "@/components/assignments/exercise-sync-notice";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/status/badge";

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
  const [t, assignment] = await Promise.all([
    getTranslations("Assignment"),
    getAssignmentDetail(assignmentId, locale),
  ]);
  const breadcrumbs = await resolveBreadcrumbs(`/assignments/${assignmentId}`, locale);

  const classProgress =
    assignment.can.viewAssignmentSolutions && assignment.groupId
      ? await getAssignmentSolverSummary(
          assignmentId,
          assignment.groupId,
          assignment.maxPointsFirst,
        )
      : null;

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
        {classProgress && (
          <ClassProgress
            assignmentId={assignmentId}
            solvers={classProgress.solvers}
            summary={classProgress.summary}
          />
        )}
      </div>
    </PageShell>
  );
}
