import { getLocale, getTranslations } from "next-intl/server";

import { getGroupDetail } from "@/lib/api/group-detail";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { GroupInfo } from "@/components/groups/group-info";
import { GroupTabs, type GroupTab } from "@/components/groups/group-tabs";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/status/badge";

/**
 * A group (S-005), tabbed per `docs/IA.md` §4.2 with the tab in `searchParams` so a particular tab
 * is a shareable URL and the back button works.
 *
 * Which tabs exist is core-api's answer, not a role check here (brief §3.4): `permissionHints`
 * decides whether the reader may see assignments or students at all. Tabs whose screens are not
 * built yet (Exams, Settings -- S-008, S-009) are simply absent rather than leading to a stub.
 *
 * An unknown `?tab=` falls back to Info rather than 404ing: the tab is a view of a resource that
 * does exist, and a stale link from an older version of this app should still show the group.
 */
export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ groupId }, { tab }, locale] = await Promise.all([params, searchParams, getLocale()]);
  const [t, group] = await Promise.all([getTranslations("Group"), getGroupDetail(groupId, locale)]);
  const breadcrumbs = await resolveBreadcrumbs(`/groups/${groupId}`, locale);

  const tabs: GroupTab[] = [{ id: "info", label: t("tabs.info") }];
  const current = tabs.some((candidate) => candidate.id === tab) ? tab! : "info";

  return (
    <PageShell
      title={group.name}
      subtitle={
        group.path.length > 0 ? group.path.map((parent) => parent.name).join(" / ") : undefined
      }
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap gap-1">
          {group.archived && <Badge tone="warning">{t("badges.archived")}</Badge>}
          {group.exam && <Badge tone="warning">{t("badges.exam")}</Badge>}
          {group.public && <Badge tone="info">{t("badges.public")}</Badge>}
        </div>
      }
      tabs={<GroupTabs groupId={groupId} tabs={tabs} current={current} />}
    >
      <GroupInfo group={group} />
    </PageShell>
  );
}
