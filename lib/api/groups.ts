import "server-only";

import { cache } from "react";

import { requireSession } from "@/lib/auth/require-session";
import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import { apiGet } from "./client";

/**
 * The two group lists the sidebar shows (`docs/IA.md` §3.1: "My Groups" and "My Teaching").
 *
 * `GET /v1/users/{id}/groups` returns them already split into `student` and `supervisor` -- which
 * matters, because the IA is explicit that these sections derive from **per-group membership**,
 * not from the global role, and that they are not mutually exclusive: someone who supervises one
 * course while taking another sees both. Core-api filters archived groups out of both lists
 * itself (confirmed in `UsersPresenter::actionGroups`), so the sidebar does not need to.
 */
export interface SidebarGroup {
  id: string;
  name: string;
}

/**
 * The caller's own standing in one group, as core-api computes it
 * (`GroupViewFactory::getStudentStatsInternal`). Verified against a live response, not the spec
 * file, which carries no response schemas at all (see `lib/api/client.ts`).
 *
 * `points.total` and `points.gained` already **include shadow assignments**, so a progress figure
 * built from them needs no second source. `points.limit` is the absolute points threshold the
 * group passes at -- core-api resolves the group's percentage `threshold` into points here, so
 * this is the only field a UI needs; `hasLimit` distinguishes "no threshold configured" (where
 * `passesLimit` is a meaningless `true`) from a real one.
 */
export interface GroupAssignmentStats {
  id: string;
  /**
   * core-api's four-value job state (`work-in-progress`, `evaluation-failed`, `failed`, `done`),
   * or `null` when the student has no *valid* best solution -- which includes both "never
   * submitted" and "every submission failed infrastructurally". See
   * `lib/status/assignment-progress.ts`, which is where that string is turned into a display state.
   */
  status: string | null;
  points: { total: number; gained: number | null; bonus: number | null };
  bestSolutionId: string | null;
  accepted: boolean | null;
  reviewRequest: boolean;
}

export interface GroupStudentStats {
  userId: string;
  groupId: string;
  points: { total: number; limit: number | null; gained: number };
  hasLimit: boolean;
  passesLimit: boolean;
  assignments: GroupAssignmentStats[];
  shadowAssignments: { id: string; points: { total: number; gained: number | null } }[];
}

interface GroupPayload {
  id: string;
  localizedTexts?: LocalizedText[];
  privateData?: { admins?: string[]; supervisors?: string[] };
}

interface UserGroupsPayload {
  student?: GroupPayload[];
  supervisor?: GroupPayload[];
  stats?: GroupStudentStats[];
}

/**
 * Memoized per request, for the same reason as `getCurrentUser()` -- see its note. The memoized
 * unit is deliberately this raw fetch rather than the locale-dependent projections below: the app
 * shell wants group names and the dashboard (S-001) wants the `stats` array, and both arrive in
 * the *same* response, so keying the cache on the request rather than on a locale argument is
 * what makes the dashboard's group data cost zero extra round trips.
 *
 * `stats` is not a separate endpoint: `UsersPresenter::actionGroups` computes
 * `GroupViewFactory::getStudentsStats()` for every group the user studies in and returns it
 * alongside. Note that it does so **without the archived filter** applied to `student`/
 * `supervisor`, so `stats` can describe groups absent from both lists -- consumers must match by
 * `groupId` rather than assume the arrays line up.
 */
const fetchUserGroups = cache(async function fetchUserGroups(): Promise<UserGroupsPayload> {
  const session = await requireSession();
  return apiGet<UserGroupsPayload>("/v1/users/{id}/groups", {
    pathParams: { id: session.userId },
  });
});

/**
 * Every non-archived group the caller can see at all -- for a normal user that is exactly the
 * groups they belong to plus their ancestors, because core-api restricts the result set by
 * membership for anyone without the global `viewAll` permission (`GroupsPresenter::actionDefault`).
 * Privileged users get the whole instance, which is what the legacy app fetches on every page too.
 *
 * Needed because **`/v1/users/{id}/groups` does not report group administrators** (S-001, DEC-058):
 * its `supervisor` key is `User::getGroupsAsSupervisor()`, one specific membership type, so a user
 * who *administers* a group appears in neither list. Group admins are only discoverable from the
 * group's own `privateData.admins`, which is how the legacy app derives the same thing.
 */
const fetchVisibleGroups = cache(async function fetchVisibleGroups(): Promise<GroupPayload[]> {
  return apiGet<GroupPayload[]>("/v1/groups");
});

export async function getMyGroups(
  locale: string,
): Promise<{ member: SidebarGroup[]; teaching: SidebarGroup[] }> {
  const [session, payload, visible] = await Promise.all([
    requireSession(),
    fetchUserGroups(),
    fetchVisibleGroups(),
  ]);

  const toSidebarGroup = (group: GroupPayload): SidebarGroup => ({
    id: group.id,
    name: localizedName(group.localizedTexts, locale),
  });

  const teaching = new Map<string, SidebarGroup>();
  for (const group of payload.supervisor ?? []) {
    teaching.set(group.id, toSidebarGroup(group));
  }
  for (const group of visible) {
    if (group.privateData?.admins?.includes(session.userId)) {
      teaching.set(group.id, toSidebarGroup(group));
    }
  }

  return {
    member: (payload.student ?? []).map(toSidebarGroup),
    teaching: [...teaching.values()].sort((a, b) => a.name.localeCompare(b.name, locale)),
  };
}

/** The caller's own stats, indexed by group id. See `GroupStudentStats` for what they cover. */
export async function getMyGroupStats(): Promise<Map<string, GroupStudentStats>> {
  const payload = await fetchUserGroups();
  return new Map((payload.stats ?? []).map((stats) => [stats.groupId, stats]));
}
