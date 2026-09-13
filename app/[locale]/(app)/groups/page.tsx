import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { canCreateRootGroup, getGroupList } from "@/lib/api/groups";
import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { CreateGroup } from "@/components/groups/create-group";
import { GroupTable } from "@/components/groups/group-table";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";
import { buttonClasses } from "@/components/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Groups" });
  return { title: t("title") };
}

/**
 * Every group the reader can see (S-004). Not two lists: core-api already decides what is visible
 * -- for a student that is their own groups plus the ancestors above them, for an administrator it
 * is the instance -- so "my groups" and "discover" (`docs/BACKLOG.md`'s note for this ticket) are
 * one table with a membership column, filterable, rather than two tables that would show the same
 * row twice.
 *
 * Archived groups are excluded, because core-api excludes them by default and because a course
 * that ended is not something to scroll past on the way to this term's. They have their own screen
 * (S-011), linked from here so the omission is visible rather than silent.
 */
export default async function GroupsPage() {
  const locale = await getLocale();
  const [breadcrumbs, t, groups, canCreate] = await Promise.all([
    resolveBreadcrumbsForNamespace("Groups", locale),
    getTranslations("Groups"),
    getGroupList(locale),
    canCreateRootGroup(),
  ]);

  return (
    <PageShell
      title={breadcrumbs[breadcrumbs.length - 1]!.label}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/archive" className={buttonClasses("outline", "sm")}>
            {t("archiveLink")}
          </Link>
          {canCreate && <CreateGroup locales={routing.locales} label={t("create.action")} />}
        </div>
      }
    >
      {groups.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <GroupTable groups={groups} tableId="groups" />
      )}
    </PageShell>
  );
}
