"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

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
