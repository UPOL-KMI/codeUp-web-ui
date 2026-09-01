"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import { requireSession } from "@/lib/auth/require-session";
import type { ActionResult } from "@/lib/forms/action-result";

/**
 * Joining a public group and leaving one, as the person themselves (S-026).
 *
 * The same two endpoints S-009's member manager calls, and deliberately a different module: these
 * take **no user id**. It comes from the session, so there is nothing in the request to tamper
 * with and no way to enrol somebody else by editing a form -- the same reasoning that keeps
 * S-022's account settings about oneself only. Putting another person in or out of a group is a
 * teacher's action and stays in `group-settings.ts`, gated by `update`.
 *
 * core-api decides, on every call: `addStudent` needs the group public, unarchived, in the
 * reader's own instance and the reader not locked into an exam; `removeStudent` needs a group that
 * does not detain its students and is not an exam group. Verified live -- joining a group that is
 * not public answers `403`, joining a public one succeeds.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("Group.membership.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

export async function joinGroup(groupId: string): Promise<ActionResult<{ groupId: string }>> {
  const session = await requireSession();
  try {
    await apiPost("/v1/groups/{id}/students/{userId}", undefined, {
      pathParams: { id: groupId, userId: session.userId },
    });
    return { success: true, data: { groupId } };
  } catch (error) {
    return failure(error, "joinFailed");
  }
}

export async function leaveGroup(groupId: string): Promise<ActionResult<{ groupId: string }>> {
  const session = await requireSession();
  try {
    await apiDelete("/v1/groups/{id}/students/{userId}", {
      pathParams: { id: groupId, userId: session.userId },
    });
    return { success: true, data: { groupId } };
  } catch (error) {
    return failure(error, "leaveFailed");
  }
}
