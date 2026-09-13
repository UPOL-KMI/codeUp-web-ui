import { getTranslations } from "next-intl/server";

import { formatPoints, formatPointsUnknown } from "@/lib/format/points";
import { assignmentProgress } from "@/lib/status/assignment-progress";
import type { UpcomingAssignment } from "@/lib/api/dashboard";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { RelativeTime } from "@/components/format/relative-time";
import { AssignmentProgressBadge } from "@/components/status/assignment-progress-badge";
import { Badge } from "@/components/status/badge";
import { DeadlineBadge } from "@/components/status/deadline-badge";

/**
 * Assignments still open for submission, nearest deadline first -- "What do I owe?" for a student
 * (S-001) and "What's coming up?" for a teacher planning around the same dates (S-002), which is
 * the same table minus the two columns about the viewer's own solution (`docs/IA.md` §4.1).
 *
 * Cross-group and urgency-ordered is the deliberate departure from the legacy dashboard, which
 * renders one collapsible box per group and leaves the reader to scan for the nearest deadline
 * themselves. Nothing is lost: the group is a column here, and the per-group view is the group's
 * own Assignments tab (S-006).
 *
 * Truncated rather than paginated. This is a landing pad, not a list view -- a teacher with four
 * groups can otherwise open the app to sixty rows -- and pagination controls would make the first
 * screen of the app a table widget. The footer states how many rows were held back so the count
 * is never silently wrong.
 *
 * Not a `DataTable`: sorting this by anything other than urgency defeats the point of the panel,
 * and the filter/pagination/URL-state machinery would all be inert here.
 *
 * The empty state is the caller's, not this component's -- "nothing is due" and "no deadlines in
 * the groups you teach" are different sentences, and passing the whole node beats plumbing two
 * strings through.
 */
const VISIBLE_ROWS = 10;

export async function UpcomingDeadlines({
  assignments,
  empty,
}: {
  assignments: UpcomingAssignment[];
  empty: React.ReactNode;
}) {
  const t = await getTranslations("Dashboard.upcoming");

  if (assignments.length === 0) return empty;

  const visible = assignments.slice(0, VISIBLE_ROWS);
  const hidden = assignments.length - visible.length;
  const showProgress = visible.some((assignment) => assignment.stats !== undefined);
  const columnCount = showProgress ? 5 : 3;

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">{t("columns.assignment")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("columns.group")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("columns.deadline")}</th>
            {showProgress && (
              <>
                <th className="px-3 py-2 text-right font-medium">{t("columns.points")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("columns.status")}</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {visible.map((assignment) => (
            <tr
              key={assignment.id}
              className="border-b border-border last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/assignments/${assignment.id}`}
                  className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {assignment.name}
                </Link>
                {assignment.isBonus && (
                  <span className="ml-2 align-middle">
                    <Badge tone="info">{t("bonus")}</Badge>
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/groups/${assignment.groupId}`}
                  className="text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {assignment.groupName}
                </Link>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <DateTime unixSeconds={assignment.effectiveDeadline} />
                  <span className="text-muted-foreground">
                    <RelativeTime unixSeconds={assignment.effectiveDeadline} />
                  </span>
                  <DeadlineBadge
                    firstDeadline={assignment.firstDeadline}
                    secondDeadline={assignment.secondDeadline}
                    allowSecondDeadline={assignment.allowSecondDeadline}
                  />
                </div>
              </td>
              {showProgress && assignment.stats && (
                <>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                    {assignmentProgress(assignment.stats) === "awaiting-review"
                      ? formatPointsUnknown(assignment.stats.total)
                      : formatPoints(assignment.stats.gained ?? 0, assignment.stats.total)}
                  </td>
                  <td className="px-3 py-2">
                    <AssignmentProgressBadge
                      stats={{
                        status: assignment.stats.status,
                        gained: assignment.stats.gained,
                        total: assignment.stats.total,
                        accepted: assignment.stats.accepted,
                      }}
                    />
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        {hidden > 0 && (
          <tfoot>
            <tr>
              <td
                colSpan={columnCount}
                className="px-3 py-2 text-center text-xs text-muted-foreground"
              >
                {t("more", { count: hidden })}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
