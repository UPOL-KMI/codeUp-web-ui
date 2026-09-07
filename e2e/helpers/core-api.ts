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
