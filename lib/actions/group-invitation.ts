"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

import { invitationSchema, type InvitationValues } from "./group-invitation.schema";

/**
 * Joining a group from an invitation link (S-023).
 *
 * There is nothing to validate: the invitation id is in the URL and the only other input is the
 * reader's own identity, which comes from the session. Every condition -- the link has not
 * expired, the group is not organizational or archived, the reader is not locked into an exam
 * elsewhere -- is checked by core-api's `checkAccept` on this call, so the answer this returns is
 * the authoritative one even though the screen has already asked the same question of
 * `permissionHints` to decide whether to offer the button.
 *
 * `actionAccept` is idempotent (`if ($group->isStudentOf($user) === false)`), so a double click
 * does not double-enrol anyone. No `revalidatePath` (DEC-021); the caller navigates to the group.
 */
export async function acceptGroupInvitation(
  invitationId: string,
): Promise<ActionResult<{ groupId: string }>> {
  const t = await getTranslations("GroupInvitation.errors");

  try {
    const group = await apiPost<{ id: string }>("/v1/group-invitations/{id}/accept", undefined, {
      pathParams: { id: invitationId },
    });
    return { success: true, data: { groupId: group.id } };
  } catch (error) {
    return {
      success: false,
      formError: error instanceof ApiError ? error.message : t("acceptFailed"),
    };
  }
}

/**
 * Minting, editing and revoking a group's invitation links (T-018).
 *
 * core-api gates all three on `canEditInvitations`; the settings tab offers them on the same hint.
 * `expireAt` is a unix timestamp or `null` for a link that never expires -- both accepted, and the
 * nullable case is what a course running all term wants.
 *
 * There is no "revoke" in core-api's vocabulary: `DELETE /v1/group-invitations/{id}` removes the
 * record, after which the link 404s. Letting one expire and deleting it are different things and
 * the screen offers both.
 */
async function invitationFailure(
  error: unknown,
  fallbackKey: string,
): Promise<ActionResult<never>> {
  const t = await getTranslations("Group.invitations.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

export async function createGroupInvitation(
  groupId: string,
  values: InvitationValues,
): Promise<ActionResult<{ invitationId: string }>> {
  const t = await getTranslations("Group.invitations.errors");
  const parsed = invitationSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    const created = await apiPost<{ id: string }>(
      "/v1/groups/{groupId}/invitations",
      { expireAt: parsed.data.expiresAt, note: parsed.data.note },
      { pathParams: { groupId } },
    );
    return { success: true, data: { invitationId: created.id } };
  } catch (error) {
    return invitationFailure(error, "createFailed");
  }
}

export async function updateGroupInvitation(
  invitationId: string,
  values: InvitationValues,
): Promise<ActionResult<{ invitationId: string }>> {
  const t = await getTranslations("Group.invitations.errors");
  const parsed = invitationSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    await apiPost(
      "/v1/group-invitations/{id}",
      { expireAt: parsed.data.expiresAt, note: parsed.data.note },
      { pathParams: { id: invitationId } },
    );
    return { success: true, data: { invitationId } };
  } catch (error) {
    return invitationFailure(error, "updateFailed");
  }
}

export async function deleteGroupInvitation(
  invitationId: string,
): Promise<ActionResult<{ invitationId: string }>> {
  try {
    await apiDelete("/v1/group-invitations/{id}", { pathParams: { id: invitationId } });
    return { success: true, data: { invitationId } };
  } catch (error) {
    return invitationFailure(error, "deleteFailed");
  }
}
