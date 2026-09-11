import { deleteSolutionIfPresent } from "./core-api";
import { cleanUpCreated } from "./created";

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
  const track = cleanUpCreated(deleteSolutionIfPresent);

  return (solutionUrl: string) => track(/\/solutions\/([0-9a-f-]+)/.exec(solutionUrl)?.[1]);
}
