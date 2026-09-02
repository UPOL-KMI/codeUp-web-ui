"use client";

import { useTranslations } from "next-intl";

import type { AssignmentSolver } from "@/lib/api/assignment-solvers";
import { formatPoints } from "@/lib/format/points";
import { ASSIGNMENT_PROGRESS_TONE } from "@/lib/status/assignment-progress";

import { Link } from "@/i18n/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/status/badge";

/**
 * Everyone the assignment was set for, and where each of them stands (S-013).
 *
 * Rows exist for students who have submitted nothing -- they are the reason a teacher opens this
 * at all -- so "no attempts" is a value in the table rather than an absence from it. Each name
 * leads to that person's own attempts at this assignment, which is the legacy
 * `/app/assignment/:id/user/:userId` screen, not their user profile.
 */
export function SolverTable({
  solvers,
  assignmentId,
}: {
  solvers: AssignmentSolver[];
  assignmentId: string;
}) {
  const t = useTranslations("Assignment.solvers");
  const status = useTranslations("Status");

  // Nobody accepted and nobody waiting on a review is the ordinary state of a fresh assignment,
  // and an always-present empty column reads as data that failed to load.
  const showFlags = solvers.some((solver) => solver.accepted || solver.reviewRequested);

  const columns: DataTableColumn<AssignmentSolver>[] = [
    {
      id: "name",
      header: t("columns.name"),
      sortable: true,
      sortValue: (solver) => solver.fullName,
      filterValue: (solver) => solver.fullName,
      cell: (solver) => (
        <Link
          href={`/assignments/${assignmentId}/users/${solver.userId}`}
          className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {solver.fullName || solver.userId}
        </Link>
      ),
    },
    {
      id: "attempts",
      header: t("columns.attempts"),
      className: "text-right tabular-nums",
      sortable: true,
      sortValue: (solver) => solver.attempts,
      cell: (solver) =>
        solver.attempts === 0 ? <span className="text-muted-foreground">—</span> : solver.attempts,
    },
    {
      id: "points",
      header: t("columns.points"),
      className: "text-right tabular-nums whitespace-nowrap",
      sortable: true,
      sortValue: (solver) => solver.gained ?? -1,
      cell: (solver) =>
        solver.gained === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            {formatPoints(solver.gained, solver.maxPoints)}
            {solver.bonus !== null && solver.bonus !== 0 && (
              <span className={solver.bonus > 0 ? "text-success" : "text-destructive"}>
                {solver.bonus > 0 ? ` +${solver.bonus}` : ` ${solver.bonus}`}
              </span>
            )}
          </>
        ),
    },
    {
      id: "status",
      header: t("columns.status"),
      filterValue: (solver) => status(`evaluation.${solver.progress}.label`),
      cell: (solver) => (
        <Badge tone={ASSIGNMENT_PROGRESS_TONE[solver.progress]}>
          {status(`evaluation.${solver.progress}.label`)}
        </Badge>
      ),
    },
    ...(showFlags
      ? [
          {
            id: "flags",
            header: t("columns.flags"),
            cell: (solver: AssignmentSolver) => (
              <div className="flex flex-wrap gap-1">
                {solver.accepted && <Badge tone="info">{t("flags.accepted")}</Badge>}
                {solver.reviewRequested && (
                  <Badge tone="warning">{t("flags.reviewRequested")}</Badge>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      id={`solvers-${assignmentId.slice(0, 8)}`}
      columns={columns}
      data={solvers}
      getRowId={(solver) => solver.userId}
      caption={t("caption")}
      filterPlaceholder={t("filterPlaceholder")}
    />
  );
}
