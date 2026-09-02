"use client";

import { useTranslations } from "next-intl";

import type { GroupListEntry } from "@/lib/api/groups";

import { Link } from "@/i18n/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/status/badge";

/**
 * The group list's table (S-004) -- the first real use of `DataTable` outside the design-system
 * showcase, and the reason its chrome was localized in the same ticket.
 *
 * A `"use client"` wrapper around it because `columns` carries functions (`cell`, `sortValue`),
 * which cannot cross the server/client boundary -- `DataTable`'s own doc comment covers the error
 * this produces. The page still fetches server-side and passes plain rows.
 *
 * The whole list is sorted, filtered and paged in the browser rather than by re-querying: it is
 * one response, already fetched to render at all, and core-api's `search` parameter would cost a
 * round trip per keystroke to reproduce what a client-side match over the same rows does
 * instantly. On an instance where an administrator can see thousands of groups this becomes the
 * wrong trade -- recorded in `docs/QUESTIONS.md` (Q-015) rather than pre-solved here.
 */
export function GroupTable({ groups, tableId }: { groups: GroupListEntry[]; tableId: string }) {
  const t = useTranslations("Groups");

  const columns: DataTableColumn<GroupListEntry>[] = [
    {
      id: "name",
      header: t("columns.name"),
      sortable: true,
      sortValue: (group) => [...group.path, group.name].join("/"),
      filterValue: (group) => [...group.path, group.name].join(" "),
      cell: (group) => (
        <div className="flex flex-col">
          {group.path.length > 0 && (
            <span className="text-xs text-muted-foreground">{group.path.join(" / ")}</span>
          )}
          <Link
            href={`/groups/${group.id}`}
            className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {group.name}
          </Link>
        </div>
      ),
    },
    {
      id: "membership",
      header: t("columns.membership"),
      sortable: true,
      sortValue: (group) => group.membership ?? "",
      filterValue: (group) => (group.membership ? t(`membership.${group.membership}`) : ""),
      cell: (group) =>
        group.membership ? (
          <Badge tone={group.membership === "teacher" ? "info" : "success"}>
            {t(`membership.${group.membership}`)}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "kind",
      header: t("columns.kind"),
      filterValue: (group) =>
        [group.organizational && t("kind.organizational"), group.public && t("kind.public")]
          .filter(Boolean)
          .join(" "),
      cell: (group) => (
        <div className="flex flex-wrap gap-1">
          {/* An organizational group holds other groups and can carry no assignments of its own --
              worth saying, because its empty assignment list is a fact about its kind, not a gap. */}
          {group.organizational && <Badge>{t("kind.organizational")}</Badge>}
          {group.public && <Badge tone="info">{t("kind.public")}</Badge>}
          {group.exam && <Badge tone="warning">{t("kind.exam")}</Badge>}
        </div>
      ),
    },
    {
      id: "students",
      header: t("columns.students"),
      className: "text-right tabular-nums",
      sortable: true,
      sortValue: (group) => group.studentCount ?? -1,
      cell: (group) => group.studentCount ?? "—",
    },
    {
      id: "assignments",
      header: t("columns.assignments"),
      className: "text-right tabular-nums",
      sortable: true,
      sortValue: (group) => group.assignmentCount ?? -1,
      cell: (group) => (group.organizational ? "—" : (group.assignmentCount ?? "—")),
    },
  ];

  return (
    <DataTable
      id={tableId}
      columns={columns}
      data={groups}
      getRowId={(group) => group.id}
      caption={t("caption")}
      filterPlaceholder={t("filter")}
    />
  );
}
