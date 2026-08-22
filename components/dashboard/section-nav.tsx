/**
 * Jump links to the dashboard's sections (S-003) -- what `docs/IA.md` §2's
 * `?tab=student|teacher|calendar` becomes once §4.1's "Both sections are visible
 * simultaneously... No mode switch" is taken at its word (DEC-057, DEC-060). Nothing is hidden;
 * this moves the reader down the page.
 *
 * Plain `<a href="#...">`, deliberately not `next-intl`'s `Link`: a fragment-only href is the one
 * navigation the browser does perfectly and instantly, with no client-side routing, no re-render,
 * and therefore nothing to re-suspend and shift the target out from under the jump. Anything that
 * changes the query string instead -- which is what an in-page `?tab=` link would do -- is a real
 * navigation, and a real navigation on this page re-streams the sections above the target.
 *
 * No `aria-current`: which section the reader is "on" is decided by where they have scrolled, not
 * by which link they last pressed, and a link that keeps claiming to be current after they scroll
 * away is worse than no claim at all. The cold deep-link case is answered server-side instead --
 * `?tab=` renders that section first.
 */
export interface SectionNavItem {
  /** The id of the section's own heading -- the jump target. */
  anchor: string;
  label: string;
}

export function SectionNav({ items, label }: { items: SectionNavItem[]; label: string }) {
  // One section is not a navigation, it is a heading.
  if (items.length < 2) return null;

  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <a
          key={item.anchor}
          href={`#${item.anchor}`}
          className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
