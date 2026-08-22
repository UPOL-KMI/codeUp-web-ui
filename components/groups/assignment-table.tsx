"use client";

import { useFormatter, useTranslations } from "next-intl";

import type { GroupAssignment } from "@/lib/api/group-detail";
import { DATE_TIME_FORMAT } from "@/lib/format/date-time";
import { formatPoints } from "@/lib/format/points";
import { assignmentProgress, ASSIGNMENT_PROGRESS_TONE } from "@/lib/status/assignment-progress";

import { Link } from "@/i18n/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { RelativeTime } from "@/components/format/relative-time";
import { Badge } from "@/components/status/badge";

/**
 * The group's assignment list (S-006). A `"use client"` wrapper, as `DataTable` requires -- its
 * `columns` carry functions, which cannot cross the server/client boundary.
 *
 * The two personal columns appear only for someone who studies in this group: a supervisor has no
 * solution of their own, and rendering "0/10, not submitted" against their name would be a claim
 * about a person who was never asked to submit. `stats === null` is the same signal the dashboard
 * uses, from the same source.
 *
 * Absolute dates are formatted with `DATE_TIME_FORMAT` rather than by `DateTime`, which is a
 * Server Component and cannot render here -- same options, same formatter, same pinned time zone,
 * so the deadline in this table and the one on the dashboard read identically.
 */
export function AssignmentTable({
  assignments,
  groupId,
}: {
  assignments: GroupAssignment[];
  groupId: string;
}) {
  const t = useTranslations("Group.assignments");
  const status = useTranslations("Status");
  const format = useFormatter();

  const showPersonal = assignments.some((assignment) => assignment.stats !== null);
  const showSecondDeadline = assignments.some((assignment) => assignment.secondDeadline !== null);

  const columns: DataTableColumn<GroupAssignment>[] = [
    {
      id: "name",
      header: t("columns.name"),
      sortable: true,
      sortValue: (assignment) => assignment.name,
      filterValue: (assignment) => assignment.name,
      cell: (assignment) => (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/assignments/${assignment.id}`}
            className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {assignment.name}
          </Link>
          {assignment.isBonus && <Badge tone="info">{t("bonus")}</Badge>}
          {/* Only a teacher ever sees a hidden assignment at all -- core-api filters them out of a
              student's response -- so the badge needs no permission check of its own. */}
          {!assignment.isPublic && <Badge>{t("hidden")}</Badge>}
        </div>
      ),
    },
    {
      id: "firstDeadline",
      header: t("columns.firstDeadline"),
      sortable: true,
      sortValue: (assignment) => assignment.firstDeadline,
      cell: (assignment) => (
        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
          <span>
            {format.dateTime(new Date(assignment.firstDeadline * 1000), DATE_TIME_FORMAT)}
          </span>
          <span className="text-muted-foreground">
            <RelativeTime unixSeconds={assignment.firstDeadline} />
          </span>
        </div>
      ),
    },
    ...(showSecondDeadline
      ? [
          {
            id: "secondDeadline",
            header: t("columns.secondDeadline"),
            sortable: true,
            sortValue: (assignment: GroupAssignment) => assignment.secondDeadline ?? 0,
            cell: (assignment: GroupAssignment) =>
              assignment.secondDeadline ? (
                <span className="whitespace-nowrap">
                  {format.dateTime(new Date(assignment.secondDeadline * 1000), DATE_TIME_FORMAT)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
        ]
      : []),
    {
      id: "maxPoints",
      header: t("columns.maxPoints"),
      className: "text-right tabular-nums",
      sortable: true,
      sortValue: (assignment) => assignment.maxPoints,
      cell: (assignment) => assignment.maxPoints,
    },
    ...(showPersonal
      ? [
          {
            id: "myPoints",
            header: t("columns.myPoints"),
            className: "text-right tabular-nums",
            sortable: true,
            sortValue: (assignment: GroupAssignment) => assignment.stats?.gained ?? -1,
            cell: (assignment: GroupAssignment) =>
              assignment.stats
                ? formatPoints(assignment.stats.gained ?? 0, assignment.stats.total)
                : "—",
          },
          {
            id: "myStatus",
            header: t("columns.myStatus"),
            filterValue: (assignment: GroupAssignment) =>
              assignment.stats
                ? status(`evaluation.${assignmentProgress(assignment.stats)}.label`)
                : "",
            cell: (assignment: GroupAssignment) => {
              if (!assignment.stats) return <span className="text-muted-foreground">—</span>;
              const state = assignmentProgress(assignment.stats);
              return (
                <Badge tone={ASSIGNMENT_PROGRESS_TONE[state]}>
                  {status(`evaluation.${state}.label`)}
                </Badge>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <DataTable
      id={`assignments-${groupId.slice(0, 8)}`}
      columns={columns}
      data={assignments}
      getRowId={(assignment) => assignment.id}
      filterPlaceholder={t("filterPlaceholder")}
    />
  );
}
