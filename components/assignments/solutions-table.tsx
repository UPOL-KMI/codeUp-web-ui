"use client";

import { useTranslations } from "next-intl";

import type { AssignmentSolutionRow } from "@/lib/api/assignment-solutions";
import { formatPoints } from "@/lib/format/points";
import { EVALUATION_TONE, evaluationStatus } from "@/lib/status/evaluation";

import { Link } from "@/i18n/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { RelativeTime } from "@/components/format/relative-time";
import { Badge } from "@/components/status/badge";

/**
 * Every attempt at one assignment (T-003), newest first.
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
export function SolutionsTable({
  solutions,
  assignmentId,
}: {
  solutions: AssignmentSolutionRow[];
  assignmentId: string;
}) {
  const t = useTranslations("AssignmentSolutions");
  const tStatus = useTranslations("Status.evaluation");

  const showPlagiarism = solutions.some((solution) => solution.plagiarismBatchId !== null);

  const columns: DataTableColumn<AssignmentSolutionRow>[] = [
    {
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
          {solution.note && <span className="text-xs text-muted-foreground">{solution.note}</span>}
        </span>
      ),
    },
    {
      id: "attempt",
      header: t("columns.attempt"),
      className: "text-right tabular-nums",
      sortable: true,
      sortValue: (solution) => solution.attemptIndex,
      cell: (solution) => solution.attemptIndex,
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
      className: "text-right tabular-nums",
      sortable: true,
      sortValue: (solution) => solution.overridden ?? solution.gained ?? -1,
      cell: (solution) =>
        solution.gained === null && solution.overridden === null ? (
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
            sortValue: (solution: AssignmentSolutionRow) =>
              solution.plagiarismBatchId === null ? 0 : 1,
            sortable: true,
            cell: (solution: AssignmentSolutionRow) =>
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
      id={`solutions-${assignmentId.slice(0, 8)}`}
      columns={columns}
      data={solutions}
      getRowId={(solution) => solution.id}
      filterPlaceholder={t("filterPlaceholder")}
    />
  );
}
