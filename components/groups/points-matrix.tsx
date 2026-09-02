import { getTranslations } from "next-intl/server";

import type { PointsMatrix } from "@/lib/api/group-detail";
import { formatPoints } from "@/lib/format/points";

import { Link } from "@/i18n/navigation";

/**
 * Every student against every assignment (T-006), which S-007's roster deliberately left out.
 *
 * A teacher reads this **down the columns** -- who has not done this piece of work -- where the
 * roster answers the row question, how one person is doing overall. That is why this is a plain
 * table rather than a `DataTable`: its columns are data, not a fixed schema, so sorting by one of
 * them would mean sorting by a column that may not exist tomorrow, and a filter box over a matrix
 * hides the shape that makes it readable.
 *
 * A cell that was never submitted is an em dash, not a zero. The difference between "scored zero"
 * and "has not started" is the whole point of looking at this, and a grid of zeroes states the
 * first about everyone doing the second. **A third state sits between them**: a student whose every
 * attempt died in the pipeline has no score and no best solution either, and calling that "nothing
 * submitted" is the complaint Q-012 records about the dashboard -- so it says so instead. Where a
 * solution exists, the cell links to it.
 *
 * Wide by nature -- one column per assignment -- so the table scrolls inside its own container and
 * the name column stays put while it does.
 */
export async function PointsMatrixTable({ matrix }: { matrix: PointsMatrix }) {
  const t = await getTranslations("Group.points");

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{t("caption")}</caption>
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium"
            >
              {t("columns.student")}
            </th>
            {matrix.columns.map((column) => (
              <th key={column.id} scope="col" className="px-3 py-2 text-right font-medium">
                <Link
                  href={`/assignments/${column.id}`}
                  className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {column.name || t("untitled")}
                </Link>
                <span className="block text-xs font-normal text-muted-foreground">
                  {column.isBonus ? t("bonusOf", { max: column.maxPoints }) : column.maxPoints}
                </span>
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t("columns.total")}
            </th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.userId} className="border-b border-border last:border-0 hover:bg-muted/30">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-medium"
              >
                <Link
                  href={`/users/${row.userId}`}
                  className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {row.fullName || row.userId}
                </Link>
              </th>
              {matrix.columns.map((column) => {
                const cell = row.cells[column.id];
                const nothing = !cell || cell.bestSolutionId === null;
                const onlyFailures = nothing && (cell?.attempts ?? 0) > 0;
                return (
                  <td
                    key={column.id}
                    className="px-3 py-2 text-right whitespace-nowrap tabular-nums"
                  >
                    {nothing ? (
                      <span className={onlyFailures ? "text-destructive" : "text-muted-foreground"}>
                        <span aria-hidden="true">{onlyFailures ? "!" : "—"}</span>
                        <span className="sr-only">
                          {onlyFailures
                            ? t("allFailed", { attempts: cell?.attempts ?? 0 })
                            : t("notSubmitted")}
                        </span>
                      </span>
                    ) : (
                      <Link
                        href={`/solutions/${cell.bestSolutionId}`}
                        className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {cell.gained ?? 0}
                      </Link>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums">
                {formatPoints(row.gained, row.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
