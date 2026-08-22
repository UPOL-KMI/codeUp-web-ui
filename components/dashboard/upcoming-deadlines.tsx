import { getTranslations } from "next-intl/server";

import { formatPoints } from "@/lib/format/points";
import type { UpcomingAssignment } from "@/lib/api/dashboard";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { RelativeTime } from "@/components/format/relative-time";
import { EmptyState } from "@/components/state/empty-state";
import { AssignmentProgressBadge } from "@/components/status/assignment-progress-badge";
import { Badge } from "@/components/status/badge";
import { DeadlineBadge } from "@/components/status/deadline-badge";

/**
 * "What do I owe?" (`docs/IA.md` §4.1) -- every assignment still open for submission, across every
 * group, nearest deadline first.
 *
 * Cross-group and urgency-ordered is the deliberate departure from the legacy dashboard, which
 * renders one collapsible box per group and leaves the student to scan for the nearest deadline
 * themselves. Nothing is lost: the group is a column here, and the per-group view is the group's
 * own Assignments tab (S-006).
 *
 * Truncated rather than paginated. This is a landing pad, not a list view -- a student with four
 * groups can otherwise open the app to sixty rows -- and pagination controls would make the first
 * screen of the app a table widget. The footer states how many rows were held back so the count
 * is never silently wrong.
 *
 * Not a `DataTable`: sorting this by anything other than urgency defeats the point of the panel,
 * and the filter/pagination/URL-state machinery would all be inert here.
 */
const VISIBLE_ROWS = 10;

export async function UpcomingDeadlines({ assignments }: { assignments: UpcomingAssignment[] }) {
  const t = await getTranslations("Dashboard.upcoming");

  if (assignments.length === 0) {
    return <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />;
  }

  const visible = assignments.slice(0, VISIBLE_ROWS);
  const hidden = assignments.length - visible.length;

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">{t("columns.assignment")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("columns.group")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("columns.deadline")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("columns.points")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("columns.status")}</th>
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
              <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                {formatPoints(assignment.stats.gained ?? 0, assignment.stats.total)}
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
            </tr>
          ))}
        </tbody>
        {hidden > 0 && (
          <tfoot>
            <tr>
              <td colSpan={5} className="px-3 py-2 text-center text-xs text-muted-foreground">
                {t("more", { count: hidden })}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
