import { test } from "@playwright/test";

import { deleteSolutionIfPresent } from "./core-api";

/**
 * Removes the solutions a spec file submitted, whether or not its tests reached their own teardown
 * (PF-011).
 *
 * The same defect `created-exercises.ts` fixes for exercises, one entity over, and with a worse
 * blast radius. Two spec files submit a real solution and both remove it at the end of the test
 * body -- `assignments.spec.ts` after its last assertion, `solution-rerun.spec.ts` in a `finally`
 * that a Playwright **timeout** skips -- so any failure before that point leaves the solution on
 * the instance.
 *
 * **Which assignment it lands on is not fixed**, and that is what makes the residue expensive:
 * both files reach the submit form through the dashboard's first row, so an orphan attaches to
 * whichever assignment the dashboard happened to sort first. F-029's "nothing submitted yet"
 * fixture had collected two that way and stopped being an empty-state fixture at all, which
 * nothing noticed because no spec asserts on that assignment by name.
 *
 * Call it once at module scope; it registers the file's `afterEach` and hands back the function
 * that takes a `/solutions/{id}` URL and remembers the id. Register the id **the moment the URL is
 * known**, before the assertions that follow, because a failure in those is the case this exists
 * for.
 */
export function cleanUpCreatedSolutions(): (solutionUrl: string) => string | null {
  const created: string[] = [];

  test.afterEach(async () => {
    // Popped rather than iterated, so a failure part-way through still shortens the list and the
    // next hook does not retry what already succeeded.
    while (created.length > 0) await deleteSolutionIfPresent(created.pop()!);
  });

  return (solutionUrl: string) => {
    // Guarded: an empty id would aim the cleanup's DELETE at the collection rather than at a
    // member of it.
    const id = /\/solutions\/([0-9a-f-]+)/.exec(solutionUrl)?.[1] ?? null;
    if (id !== null) created.push(id);
    return id;
  };
}
