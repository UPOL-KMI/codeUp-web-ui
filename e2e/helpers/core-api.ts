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
