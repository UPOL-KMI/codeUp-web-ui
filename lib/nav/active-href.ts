/**
 * Which sidebar link is highlighted for a given path (D-014).
 *
 * **Only the most specific match**, because several links can contain the current path at once:
 * `/groups` contains every group page, so opening a course lit both "All groups" and the course
 * itself and the highlight stopped meaning anything. Reported by the operator, who saw it on a
 * teacher's sidebar and on a student's.
 *
 * The longest containing href is the reader's actual place in the tree. When the open group is not
 * in the sidebar at all -- an admin browsing somebody else's course -- `/groups` is the only match
 * and still lights, which is the behaviour worth keeping rather than an accident of this rule.
 *
 * Containment is by path segment (`${href}/`), not by string prefix, so `/exercises` does not
 * claim a hypothetical `/exercises-archive`.
 *
 * `pathname` must be the **locale-aware** one -- `/groups`, not `/cs/groups`.
 */
export function activeNavHref(hrefs: readonly string[], pathname: string): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (pathname !== href && !pathname.startsWith(`${href}/`)) continue;
    if (best === null || href.length > best.length) best = href;
  }
  return best;
}
