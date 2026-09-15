"use client";

import { useTranslations } from "next-intl";

import type { AssignmentSolutionRow } from "@/lib/api/assignment-solutions";
import { formatPoints, formatPointsUnknown } from "@/lib/format/points";
import { EVALUATION_TONE, evaluationStatus } from "@/lib/status/evaluation";

import { Link } from "@/i18n/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { RelativeTime } from "@/components/format/relative-time";
import { Badge } from "@/components/status/badge";

/**
 * Attempts, newest first: every one at a single assignment (T-003), or every one a single student
 * made anywhere in a group (T-005). `lead` picks which of the two the first column names -- the
 * rest of the columns are the same seven either way, deliberately, because a teacher moving
 * between the two screens is reading the same rows sliced differently and should not have to
 * re-learn the table.
 *
 * One row per **submission**, which is the difference between this and the class-progress table on
 * the assignment screen: that one summarises a student, this one is the individual attempts, so a
 * student who submitted eleven times appears eleven times and each row opens its own solution.
 *
 * The evaluation state comes from `evaluationStatus()`, the same function the solution screen's
 * badge and the dashboard's use -- rendered here rather than through `EvaluationBadge`, which is a
 * Server Component and cannot be called from inside a `DataTable` column (the columns must be
 * defined in the client boundary; see `data-table.tsx`'s own note).
 *
 * The date is relative and client-rendered for the reason D-012 gives; the absolute value travels
 * with it in the `<time>` element, and sorting is on the raw timestamp rather than on either.
 */
export type SolutionsTableRow = AssignmentSolutionRow & {
  /** Present only in `lead="assignment"` mode, where the rows span a whole group (T-005). */
  assignment?: { id: string; name: string; canViewSolutions: boolean };
};

export function SolutionsTable({
  solutions,
  scopeId,
  lead = "author",
}: {
  solutions: SolutionsTableRow[];
  /** Whatever the rows are a list *of* -- an assignment (T-003) or a student (T-005). Only its
   *  first bytes are used, to key this table's own `searchParams` (see `DataTable`'s `id`). */
  scopeId: string;
  lead?: "author" | "assignment";
}) {
  const t = useTranslations("AssignmentSolutions");
  const tStatus = useTranslations("Status.evaluation");

  const showPlagiarism = solutions.some((solution) => solution.plagiarismBatchId !== null);

  const leadColumn: DataTableColumn<SolutionsTableRow> =
    lead === "author"
      ? {
          id: "author",
          header: t("columns.author"),
          sortable: true,
          sortValue: (solution) => solution.authorName,
          filterValue: (solution) => `${solution.authorName} ${solution.note}`,
          cell: (solution) => (
            <span className="flex flex-col gap-0.5">
              <Link
                href={`/solutions/${solution.id}`}
                className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {solution.authorName || solution.authorId}
              </Link>
              {solution.note && (
                <span className="text-xs text-muted-foreground">{solution.note}</span>
              )}
            </span>
          ),
        }
      : {
          id: "assignment",
          header: t("columns.assignment"),
          sortable: true,
          sortValue: (solution) => solution.assignment?.name ?? "",
          filterValue: (solution) => `${solution.assignment?.name ?? ""} ${solution.note}`,
          cell: (solution) => (
            <span className="flex flex-col gap-0.5">
              <Link
                href={
                  solution.assignment?.canViewSolutions
                    ? `/assignments/${solution.assignment.id}/solutions`
                    : `/assignments/${solution.assignment?.id}`
                }
                className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {solution.assignment?.name || t("untitledAssignment")}
              </Link>
              {solution.note && (
                <span className="text-xs text-muted-foreground">{solution.note}</span>
              )}
            </span>
          ),
        };

  const columns: DataTableColumn<SolutionsTableRow>[] = [
    leadColumn,
    {
      id: "attempt",
      header: t("columns.attempt"),
      align: "right" as const,
      className: "tabular-nums",
      sortable: true,
      sortValue: (solution) => solution.attemptIndex,
      // The row's way into the solution itself. In `lead="author"` mode the name above is that
      // link too; in `lead="assignment"` mode the lead cell names the *assignment*, so without
      // this the row would list a submission with no way to open it.
      cell: (solution) => (
        <Link
          href={`/solutions/${solution.id}`}
          className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {solution.attemptIndex}
        </Link>
      ),
    },
    {
      id: "submitted",
      header: t("columns.submitted"),
      sortable: true,
      sortValue: (solution) => solution.createdAt,
      cell: (solution) => <RelativeTime unixSeconds={solution.createdAt} />,
    },
    {
      id: "environment",
      header: t("columns.environment"),
      sortable: true,
      sortValue: (solution) => solution.environment,
      filterValue: (solution) => solution.environment,
      cell: (solution) => <span className="text-muted-foreground">{solution.environment}</span>,
    },
    {
      id: "points",
      header: t("columns.points"),
      align: "right" as const,
      className: "tabular-nums",
      sortable: true,
      sortValue: (solution) => solution.overridden ?? solution.gained ?? -1,
      cell: (solution) =>
        // **A question mark, not a number, while nobody has marked it.** The row's own state says
        // "waiting to be marked"; printing the pipeline's figure beside that reads as a grade.
        evaluationStatus(solution.status) === "awaiting-review" ? (
          <span className="text-muted-foreground">{formatPointsUnknown(solution.maxPoints)}</span>
        ) : solution.gained === null && solution.overridden === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatPoints(
            (solution.overridden ?? solution.gained ?? 0) + solution.bonus,
            solution.maxPoints,
          )
        ),
    },
    {
      id: "status",
      header: t("columns.status"),
      sortable: true,
      sortValue: (solution) => evaluationStatus(solution.status),
      cell: (solution) => {
        const status = evaluationStatus(solution.status);
        return (
          <span className="flex flex-wrap items-center gap-1">
            <Badge tone={EVALUATION_TONE[status]} title={tStatus(`${status}.description`)}>
              {tStatus(`${status}.label`)}
            </Badge>
            {/* **What the tests did, beside what it was worth.** The badge is read off the
                evaluation's score, and the two part company as soon as a test carries no weight --
                the operator watched a passing test sit beside "Špatně". The tally is the fact; the
                badge is the verdict on it. */}
            {solution.tests && (
              <span className="text-xs text-muted-foreground">
                {tStatus("testsPassed", {
                  passed: solution.tests.passed,
                  total: solution.tests.total,
                })}
              </span>
            )}
            {solution.isBest && <Badge tone="success">{t("flags.best")}</Badge>}
            {solution.accepted && <Badge tone="success">{t("flags.accepted")}</Badge>}
            {solution.pastDeadline && <Badge tone="warning">{t("flags.late")}</Badge>}
          </span>
        );
      },
    },
    {
      id: "review",
      header: t("columns.review"),
      sortable: true,
      sortValue: (solution) =>
        solution.reviewClosedAt !== null
          ? 3
          : solution.reviewStartedAt !== null
            ? 2
            : solution.reviewRequested
              ? 1
              : 0,
      cell: (solution) =>
        solution.reviewClosedAt !== null ? (
          <Badge tone="success">
            {solution.reviewIssues > 0
              ? t("review.closedWithIssues", { count: solution.reviewIssues })
              : t("review.closed")}
          </Badge>
        ) : solution.reviewStartedAt !== null ? (
          <Badge tone="info">{t("review.open")}</Badge>
        ) : solution.reviewRequested ? (
          <Badge tone="warning">{t("review.requested")}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    ...(showPlagiarism
      ? [
          {
            id: "plagiarism",
            header: t("columns.similarities"),
            sortValue: (solution: SolutionsTableRow) =>
              solution.plagiarismBatchId === null ? 0 : 1,
            sortable: true,
            cell: (solution: SolutionsTableRow) =>
              solution.plagiarismBatchId === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <Link
                  href={`/solutions/${solution.id}/plagiarisms`}
                  className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Badge tone="warning">{t("flags.similarities")}</Badge>
                </Link>
              ),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      id={`solutions-${scopeId.slice(0, 8)}`}
      columns={columns}
      data={solutions}
      getRowId={(solution) => solution.id}
      caption={lead === "author" ? t("caption") : t("captionByAssignment")}
      filterPlaceholder={lead === "author" ? t("filterPlaceholder") : t("filterByAssignment")}
    />
  );
}
