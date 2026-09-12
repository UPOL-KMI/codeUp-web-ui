import { Link } from "@/i18n/navigation";

/**
 * Tab navigation for a page whose tabs are `?tab=` on its own address (D-001's `PageShell` slot).
 *
 * Extracted from `GroupTabs` when the exercise settings screen needed the same thing (T-033): the
 * markup, the active state and the "a tab is a link, not a button" rule were all worth having
 * once. The group's own component is now a thin wrapper, so its callers did not have to change.
 *
 * Tab state lives in the URL exactly as `docs/IA.md` §4.2 specifies, so the back button and a
 * shared link both land on the tab the reader was looking at.
 */
export interface PageTab {
  id: string;
  label: string;
}

export function PageTabs({
  basePath,
  tabs,
  current,
  label,
}: {
  /** The page's own path, without the query -- e.g. `/exercises/<id>/edit`. */
  basePath: string;
  tabs: PageTab[];
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
            href={`${basePath}?tab=${tab.id}`}
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
