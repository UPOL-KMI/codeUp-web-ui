import { test } from "@playwright/test";

/**
 * Removes what a spec file created, whether or not its tests reached their own teardown.
 *
 * **The shared middle of PF-007, PF-011 and PF-014**, which each found the same defect on a
 * different entity: a spec creates something real and removes it at the end of the test body, so
 * any failure in between leaves it on the instance. A `try`/`finally` is not the fix either -- a
 * Playwright **timeout** skips it -- and a teardown that drives the *page* cannot run at all once
 * the page is the thing that died, which is how `instances.spec.ts` was leaving an instance and an
 * orphaned root group in every superadmin's sidebar.
 *
 * Call it once at module scope with the function that removes one id; it registers the file's
 * `afterEach` and hands back a `track` that remembers an id and returns it. Register the id **the
 * moment it is known**, before the assertions that follow, because a failure in those is the case
 * this exists for. The removal each test performs itself is usually what that test is *asserting*,
 * so in the ordinary case this finds the thing already gone and does nothing.
 */
export function cleanUpCreated<Id>(
  remove: (id: Id) => Promise<void>,
): (id: Id | null | undefined) => Id | null {
  const created: Id[] = [];

  test.afterEach(async () => {
    // Popped rather than iterated, so a failure part-way through still shortens the list and the
    // next hook does not retry what already succeeded.
    while (created.length > 0) await remove(created.pop()!);
  });

  return (id: Id | null | undefined) => {
    if (id === null || id === undefined) return null;
    created.push(id);
    return id;
  };
}
