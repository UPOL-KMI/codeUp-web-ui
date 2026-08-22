import { getLocale, getTranslations } from "next-intl/server";

import { getGroupList } from "@/lib/api/groups";
import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { GroupTable } from "@/components/groups/group-table";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";

/**
 * Archived groups (S-011) -- the same entity, the same table, one query parameter changed
 * (`onlyArchived`). Deliberately not a filter toggle on `/groups`: archiving a group is how a
 * finished course stops competing for attention with the current one, and a toggle that can leave
 * the list showing both defeats that. It is its own destination, and the group list links here.
 *
 * **No unarchive action yet.** Core-api has `POST /v1/groups/{id}/archived`, and
 * `permissionHints.archive` says who may call it, but a mutation belongs with the rest of group
 * administration in S-009 rather than being the one write on an otherwise read-only screen.
 * Recorded on that ticket.
 */
export default async function ArchivePage() {
  const locale = await getLocale();
  const [breadcrumbs, t, groups] = await Promise.all([
    resolveBreadcrumbsForNamespace("Archive", locale),
    getTranslations("Archive"),
    getGroupList(locale, "archived"),
  ]);

  return (
    <PageShell
      title={breadcrumbs[breadcrumbs.length - 1]!.label}
      subtitle={t("subtitle")}
      breadcrumbs={breadcrumbs}
      actions={
        <Link
          href="/groups"
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("activeLink")}
        </Link>
      }
    >
      {groups.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <GroupTable groups={groups} tableId="archive" />
      )}
    </PageShell>
  );
}
