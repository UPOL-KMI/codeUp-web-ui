import { getTranslations } from "next-intl/server";

import type { AssignmentSolutionRow } from "@/lib/api/assignment";
import { formatPoints } from "@/lib/format/points";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { RelativeTime } from "@/components/format/relative-time";
import { Badge } from "@/components/status/badge";
import { EvaluationBadge } from "@/components/status/evaluation-badge";

/**
 * One person's attempts at one assignment, newest first.
 *
 * Shared by the assignment screen's "my solutions" (S-012) and by the same table read about
 * someone else (S-013) -- the columns are identical because the question is, and a teacher
 * comparing their own view against a student's should not be reading two different tables.
 */
export async function SolutionList({ solutions }: { solutions: AssignmentSolutionRow[] }) {
  const t = await getTranslations("Assignment");

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">{t("columns.attempt")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("columns.submitted")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("columns.points")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("columns.status")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("columns.flags")}</th>
          </tr>
        </thead>
        <tbody>
          {solutions.map((solution) => (
            <tr
              key={solution.id}
              className="border-b border-border last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/solutions/${solution.id}`}
                  className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {t("attemptNumber", { index: solution.attemptIndex })}
                </Link>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <DateTime unixSeconds={solution.createdAt} withSeconds />
                  <span className="text-muted-foreground">
                    <RelativeTime unixSeconds={solution.createdAt} />
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                {formatPoints(solution.gained ?? 0, solution.maxPoints)}
                {solution.bonus !== 0 && (
                  <span className={solution.bonus > 0 ? "text-success" : "text-destructive"}>
                    {solution.bonus > 0 ? ` +${solution.bonus}` : ` ${solution.bonus}`}
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <EvaluationBadge solution={solution.evaluation} />
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {solution.isBest && <Badge tone="success">{t("flags.best")}</Badge>}
                  {solution.accepted && <Badge tone="info">{t("flags.accepted")}</Badge>}
                  {solution.reviewRequested && !solution.reviewClosed && (
                    <Badge tone="warning">{t("flags.reviewRequested")}</Badge>
                  )}
                  {solution.reviewClosed && <Badge>{t("flags.reviewed")}</Badge>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
