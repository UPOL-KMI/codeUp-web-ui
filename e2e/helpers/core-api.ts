import { SUPERADMIN } from "./accounts";

/**
 * Where core-api itself answers, for the one thing this harness cannot get from the app.
 *
 * Same shape as `base-url.ts`: a default that matches `.env.local`'s `API_BASE_PUBLIC` on a local
 * `docker compose` stack, overridable for a deployment that publishes it elsewhere. Playwright
 * does not load `.env.local` (only the app under test does), so this cannot simply read it.
 */
export const coreApiBase = process.env.PLAYWRIGHT_API_BASE ?? "http://localhost/api/v1";

async function coreApi<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${coreApiBase}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as { success: boolean; payload: T; error?: unknown };
  if (!response.ok || !body.success) {
    throw new Error(`core-api GET ${path} failed: HTTP ${response.status}`);
  }
  return body.payload;
}

/**
 * Delete a pipeline directly, for a spec's own cleanup (T-015/T-016).
 *
 * **The only write in this helper, and it exists because a failing spec left forks behind.** A
 * pipeline the suite created is the suite's to remove, and a test that dies before its own
 * teardown must not leave the instance's list growing -- the next run then finds two pipelines of
 * one name and its `.first()` picks whichever. Returns quietly if the pipeline is already gone,
 * which is the ordinary case when the test's own deletion succeeded.
 */
export async function deletePipelineIfPresent(pipelineId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/pipelines/${pipelineId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * Delete an assignment directly, for a spec's own cleanup (T-012).
 *
 * Sibling of `deletePipelineIfPresent`, and for the same reason: an assignment made from a seeded
 * exercise **inherits that exercise's name**, so one left behind by a failed run is invisible to
 * any name-based sweep and simply accumulates. A spec that creates one owns it whether or not it
 * reaches its own teardown.
 */
export async function deleteAssignmentIfPresent(assignmentId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/exercise-assignments/${assignmentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * Delete a group directly, for a spec's own cleanup (AD-004).
 *
 * Third of its kind, and the reason is core-api's rather than a spec's carelessness: deleting an
 * **instance** does not delete its root group (Q-023), so a spec that creates an instance and
 * removes it again still leaves a group behind -- listed among the groups and, because the creator
 * administers it, in the sidebar of every superadmin page. Eight of them had accumulated before
 * anybody looked at a sidebar.
 */
export async function deleteGroupIfPresent(groupId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/groups/${groupId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

async function coreApiToken(): Promise<string> {
  const response = await fetch(`${coreApiBase}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: SUPERADMIN.email, password: SUPERADMIN.password }),
  });
  if (!response.ok) throw new Error(`core-api login failed: HTTP ${response.status}`);
  const body = (await response.json()) as { payload: { accessToken: string } };
  return body.payload.accessToken;
}

/**
 * A seeded solution that has **no review yet** (G-003).
 *
 * Distinct from `firstSeededSolution` on purpose: the seed opens a review on its first solution, and
 * asking for a review is deliberately not offered once one exists -- so a test of the request
 * control that used the first solution would be asserting against the guard rather than the
 * control. Found rather than pinned, for the same reason as its neighbour.
 */
export async function seededSolutionWithoutReview(): Promise<{ id: string; authorId: string }> {
  const token = await coreApiToken();
  const groups = await coreApi<{ privateData?: { assignments?: string[] } }[]>("/groups", token);
  for (const group of groups) {
    for (const assignmentId of group.privateData?.assignments ?? []) {
      const solutions = await coreApi<{ id: string; authorId: string; review: unknown | null }[]>(
        `/exercise-assignments/${assignmentId}/solutions`,
        token,
      );
      const clean = solutions.find((solution) => solution.review === null);
      if (clean) return { id: clean.id, authorId: clean.authorId };
    }
  }
  throw new Error("no seeded solution without a review");
}

/** Set or clear a solution's review request without going through a screen, for teardown (G-003). */
export async function setReviewRequestedDirectly(
  solutionId: string,
  value: boolean,
): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/assignment-solutions/${solutionId}/set-flag/reviewRequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  }).catch(() => undefined);
}

/**
 * The submission ids a solution currently has (G-002).
 *
 * A resubmit adds one to the *same* solution rather than creating a new one, so a spec that
 * re-runs a seeded solution has to know which submissions were there before in order to put it
 * back. Pairs with `deleteSubmissionIfPresent`.
 */
export async function solutionSubmissionIds(solutionId: string): Promise<string[]> {
  const token = await coreApiToken();
  const solution = await coreApi<{ submissions: string[] }>(
    `/assignment-solutions/${solutionId}`,
    token,
  );
  return solution.submissions;
}

/**
 * Make an evaluation failure of this suite's own, and hand back the job id the screen shows it by
 * (PF-006).
 *
 * **Written because the suite was quietly draining a shared queue.** The resolve test used to take
 * whatever unresolved failure was oldest, on the reasoning that this instance mints a fresh one
 * every time the submit spec runs -- which stopped being true when that spec started deleting the
 * solution it submits, because deleting a solution takes its failures with it. Resolving is
 * permanent (core-api has no un-resolve), so the queue drained by one per run until it was empty
 * and three tests went red for a reason that had nothing to do with them.
 *
 * A re-run of a seeded solution is the cheapest honest way to mint one: this host's sandbox cannot
 * run at all (DEC-031), so every job fails within a second. The caller deletes the submission
 * afterwards, which takes the failure with it.
 */
export async function mintSubmissionFailure(): Promise<{ submissionId: string; jobId: string }> {
  const token = await coreApiToken();
  const { id } = await firstSeededSolution();
  const before = new Set(await solutionSubmissionIds(id));

  const response = await fetch(`${coreApiBase}/assignment-solutions/${id}/resubmit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ debug: false }),
  });
  if (!response.ok) throw new Error(`could not resubmit: HTTP ${response.status}`);

  // The job is rejected by the sandbox rather than queued, but core-api records the failure a
  // moment after answering the resubmit -- so this waits for the row rather than assuming it.
  for (let attempt = 0; attempt < 40; attempt++) {
    const added = (await solutionSubmissionIds(id)).filter((one) => !before.has(one));
    const submissionId = added[0];
    if (submissionId !== undefined) {
      const failures = await coreApi<
        { id: string; description: string; resolvedAt: number | null }[]
      >("/submission-failures", token);
      // The job id core-api names in the description **is** the submission's own id, which is what
      // makes the row findable on a screen where every failure reads alike.
      if (failures.some((failure) => failure.description.includes(submissionId))) {
        return { submissionId, jobId: submissionId };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("no submission failure appeared for the re-run");
}

/** Delete one evaluation run of a solution, for a spec that caused an extra one (G-002). */
export async function deleteSubmissionIfPresent(submissionId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/assignment-solutions/submission/${submissionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * Delete a solution a spec submitted, for its own cleanup.
 *
 * **Added because the submit test was not idempotent.** It uploads a real file and creates a real
 * solution every run, and removed none of them -- so Alice's attempt count grew by one per full
 * suite run until `assignment-solutions.spec.ts`'s `toHaveCount(3)` stopped being true. That is the
 * suite reporting on its own history rather than on the app. Returns quietly if it is already gone.
 */
export async function deleteSolutionIfPresent(solutionId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/assignment-solutions/${solutionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * Several attempts by one student at one assignment, oldest first (G-005).
 *
 * The comparison screen needs two solutions by the **same author**, which is what it offers to
 * compare; the seed leaves three under its primary assignment and their contents genuinely differ.
 * Found rather than pinned, like its neighbours.
 */
export async function seededAttemptsOfOneAuthor(): Promise<
  { id: string; attemptIndex: number; note: string }[]
> {
  const token = await coreApiToken();
  const groups = await coreApi<{ privateData?: { assignments?: string[] } }[]>("/groups", token);
  for (const group of groups) {
    for (const assignmentId of group.privateData?.assignments ?? []) {
      const solutions = await coreApi<
        { id: string; attemptIndex: number; note: string; authorId: string }[]
      >(`/exercise-assignments/${assignmentId}/solutions`, token);
      const byAuthor = new Map<string, typeof solutions>();
      for (const solution of solutions) {
        byAuthor.set(solution.authorId, [...(byAuthor.get(solution.authorId) ?? []), solution]);
      }
      for (const attempts of byAuthor.values()) {
        if (attempts.length >= 2) {
          return [...attempts]
            .sort((a, b) => a.attemptIndex - b.attemptIndex)
            .map(({ id, attemptIndex, note }) => ({ id, attemptIndex, note }));
        }
      }
    }
  }
  throw new Error("no seeded author with two attempts at one assignment");
}

/** Delete a shadow assignment a spec created, for its own cleanup (G-009). */
export async function deleteShadowAssignmentIfPresent(shadowId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/shadow-assignments/${shadowId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * A seeded solution to act on, and the assignment maximum it is scored against (G-001).
 *
 * Found rather than hardcoded: `scripts/seed.ts` does not publish solution ids, and pinning one
 * would break the moment the seed changed. Returns the first solution of the first seeded
 * assignment that has any, which is stable for a given seeded database and is all the caller needs.
 */
export async function firstSeededSolution(): Promise<{ id: string; maxPoints: number }> {
  const token = await coreApiToken();
  const groups = await coreApi<{ privateData?: { assignments?: string[] } }[]>("/groups", token);
  for (const group of groups) {
    for (const assignmentId of group.privateData?.assignments ?? []) {
      const solutions = await coreApi<{ id: string; maxPoints: number }[]>(
        `/exercise-assignments/${assignmentId}/solutions`,
        token,
      );
      const first = solutions[0];
      if (first) return { id: first.id, maxPoints: first.maxPoints };
    }
  }
  throw new Error("no seeded solution to act on");
}

/**
 * Put a solution's teacher-set fields back where the seed leaves them (G-001).
 *
 * The verdict spec mutates a *seeded* solution rather than creating one, because on this host no
 * evaluation can succeed (DEC-031) and a freshly submitted solution is in a state no teacher ever
 * sees. That makes restoring it the price, and it belongs here beside the other teardowns rather
 * than in the spec.
 */
export async function restoreSolutionVerdict(solutionId: string): Promise<void> {
  const token = await coreApiToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  await fetch(`${coreApiBase}/assignment-solutions/${solutionId}/set-flag/accepted`, {
    method: "POST",
    headers,
    body: JSON.stringify({ value: false }),
  }).catch(() => undefined);
  await fetch(`${coreApiBase}/assignment-solutions/${solutionId}/bonus-points`, {
    method: "POST",
    headers,
    body: JSON.stringify({ bonusPoints: 0, overriddenPoints: null }),
  }).catch(() => undefined);
}

/**
 * The ids of the seeded group invitations, keyed by their seed note (S-023).
 *
 * **The only fixture in this suite fetched from core-api rather than found in the app**, and
 * deliberately so: an invitation id reaches its recipient out of band -- in an email, or pasted
 * into a chat -- so there is no screen a *recipient* could read it from.
 *
 * T-018 built the minting side, and the S-023 row expected that to retire this helper. It does
 * not, quite: two of the five seeded fixtures are on groups whose settings tab shows no invitation
 * section at all -- an organizational group cannot be joined, so the section is hidden there, and
 * so the only way to a link on one is this. What T-018 did change is that the *ordinary* case is
 * now clickable, which is what `group-invitations.spec.ts`'s management test exercises.
 *
 * Called once per spec file (`test.beforeAll`), not per test -- core-api's login is bcrypt-slow,
 * which is the same reason `loginAndGetCookie` is called once per persona.
 */
export async function seededInvitationIds(): Promise<Map<string, string>> {
  const token = await coreApiToken();
  const groups = await coreApi<{ id: string }[]>("/groups?archived=true", token);

  const found = new Map<string, string>();
  for (const group of groups) {
    const invitations = await coreApi<{ id: string; note: string | null }[]>(
      `/groups/${group.id}/invitations`,
      token,
    );
    for (const invitation of invitations) {
      if (invitation.note?.startsWith("[seed] ")) found.set(invitation.note, invitation.id);
    }
  }
  return found;
}
