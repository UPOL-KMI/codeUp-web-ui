import { test } from "@playwright/test";

import { deleteExerciseIfPresent } from "./core-api";

/**
 * Removes the exercises a spec file created, whether or not its tests reached their own teardown
 * (PF-007).
 *
 * **Six spec files create a real exercise and all six deleted it only at the end of the test
 * body**, so any failure in between left it on the instance -- and because core-api names a new
 * exercise after its author rather than after the suite, an orphan carries no `[e2e]` prefix to
 * sweep on and is indistinguishable from one a real supervisor started and abandoned. Four had
 * accumulated on the development instance before anybody counted them, and they were what made
 * G-031b's empty-difficulty cell look like seeded data when it was detritus.
 *
 * PF-007 named one of the six. It is shared rather than copied because six copies of a hook is six
 * places for the seventh spec to forget it, and because the deletion at the end of each test is
 * the thing those tests are *asserting* -- this runs after it, finds the exercise already gone in
 * the ordinary case, and only does work when something went wrong.
 *
 * Call it once at module scope; it registers the file's `afterEach` and hands back the function
 * that takes an `/exercises/{id}/edit` URL and remembers the id. Register the id **before** the
 * assertions that follow the creation, because a failure in those is the case this exists for.
 */
export function cleanUpCreatedExercises(): (editUrl: string) => string | null {
  const created: string[] = [];

  test.afterEach(async () => {
    // Popped rather than iterated, so a failure part-way through still shortens the list and the
    // next hook does not retry what already succeeded.
    while (created.length > 0) await deleteExerciseIfPresent(created.pop()!);
  });

  return (editUrl: string) => {
    // Guarded: an empty id would aim the cleanup's DELETE at the collection rather than at a
    // member of it.
    const id = /\/exercises\/([0-9a-f-]+)/.exec(editUrl)?.[1] ?? null;
    if (id !== null) created.push(id);
    return id;
  };
}
