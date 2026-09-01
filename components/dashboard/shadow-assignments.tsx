import { getTranslations } from "next-intl/server";

import { formatPoints } from "@/lib/format/points";
import type { MyShadowAssignment } from "@/lib/api/dashboard";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { Badge } from "@/components/status/badge";

/**
 * Work the reader is graded on but submits nothing for (S-025): an oral exam, a presentation,
 * attendance. Their **points** were already on this page inside the group progress cards, because
 * core-api folds shadow points into the group totals; what was missing is which ones they are.
 *
 * A list of its own rather than rows in the deadline table above, for the reason DEC-079 gave when
 * the group screen faced the same question: every column of that table is about a submission --
 * status, points earned so far, whether a second deadline still applies -- and not one of them can
 * be filled in for something with nothing to submit.
 *
 * **The deadline is stated as informative, in those words.** core-api's own documentation says the
 * supervisor decides whether one was breached, so this column carries no urgency badge and no
 * relative time: both would claim a countdown that means nothing here. Rows still awaiting points
 * come first -- those are the ones the reader might act on.
 */
const VISIBLE_ROWS = 8;

export async function ShadowAssignments({ assignments }: { assignments: MyShadowAssignment[] }) {
  const t = await getTranslations("Dashboard.shadow");

  const visible = assignments.slice(0, VISIBLE_ROWS);
  const hidden = assignments.length - visible.length;
  const showNotes = visible.some((assignment) => assignment.myNote !== "");

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t("explain")}</p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">{t("columns.assignment")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("columns.group")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("columns.deadline")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("columns.points")}</th>
              {showNotes && (
                <th className="px-3 py-2 text-left font-medium">{t("columns.note")}</th>
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
                    href={`/shadow-assignments/${assignment.id}`}
                    className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {assignment.name || t("untitled")}
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
                <td className="px-3 py-2 text-muted-foreground">
                  {assignment.deadline !== null ? (
                    <DateTime unixSeconds={assignment.deadline} dateOnly />
                  ) : (
                    t("noDeadline")
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                  {assignment.myPoints !== null ? (
                    formatPoints(assignment.myPoints, assignment.maxPoints)
                  ) : (
                    <span className="text-muted-foreground">
                      {t("notAwarded", { max: assignment.maxPoints })}
                    </span>
                  )}
                </td>
                {showNotes && (
                  <td className="px-3 py-2 text-muted-foreground">{assignment.myNote}</td>
                )}
              </tr>
            ))}
          </tbody>
          {hidden > 0 && (
            <tfoot>
              <tr>
                <td
                  colSpan={showNotes ? 5 : 4}
                  className="px-3 py-2 text-center text-xs text-muted-foreground"
                >
                  {t("more", { count: hidden })}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
