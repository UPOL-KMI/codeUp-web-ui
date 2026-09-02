import { Link } from "@/i18n/navigation";

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
  return (
    <nav aria-label={label} className="-mb-px flex flex-wrap gap-1">
      {tabs.map((tab) => {
        const active = tab.id === current;
        return (
          <Link
            key={tab.id}
            href={`/groups/${groupId}?tab=${tab.id}`}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
