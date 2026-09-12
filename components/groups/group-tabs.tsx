import { PageTabs } from "@/components/page-tabs";

/**
 * The group's tab navigation (S-005), rendered into `PageShell`'s `tabs` slot (D-001).
 *
 * Tab state lives in `searchParams` (`?tab=info|assignments|students|...`), exactly as
 * `docs/IA.md` §4.2 specifies: "No page reload on tab switch -- Server Component re-render with
 * different search params." Each tab is a real link to a real URL, so the browser's back button
 * and a shared link both work, and a tab is a `<Link>` rather than a button because it navigates.
 *
 * **A tab appears only when the reader may see what is behind it, and only when it is built.**
 * The first is core-api's answer (`permissionHints`), never a role check here (brief §3.4); the
 * second keeps this from advertising S-008's and S-009's screens before they exist -- a tab that
 * leads to "not built yet" is worse than no tab.
 */
export interface GroupTab {
  id: string;
  label: string;
}

export function GroupTabs({
  groupId,
  tabs,
  current,
  label,
}: {
  groupId: string;
  tabs: GroupTab[];
  current: string;
  label: string;
}) {
  return <PageTabs basePath={`/groups/${groupId}`} tabs={tabs} current={current} label={label} />;
}
