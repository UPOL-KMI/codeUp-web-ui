"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

import { groupSettingsSchema, type GroupSettingsValues } from "./group-settings.schema";

/**
 * Administering a group (S-009): its settings, what kind of group it is, where it hangs in the
 * hierarchy, who belongs to it, the links that let people join it, and its removal.
 *
 * As everywhere else in this app, none of these check whether the caller may do them: core-api's
 * `update`, `setOrganizational`, `setExamFlag`, `archive`, `relocate`, `remove`,
 * and `remove` decide that on every call, and a Server Action is a
 * public HTTP endpoint whatever the UI rendered (brief §6). The hints decide what to offer.
 *
 * **No `revalidatePath`** (DEC-021): every read is `no-store`, so there is nothing cached to
 * invalidate; callers refresh the router, which re-runs the server render.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("Group.settings.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

/**
 * core-api replaces the whole group with what it is sent -- there is no partial update -- so the
 * form always submits every field it owns, and a `threshold` and a `pointsLimit` are mutually
 * exclusive by its own rule rather than by omission.
 */
export async function updateGroupSettings(
  groupId: string,
  values: GroupSettingsValues,
): Promise<ActionResult<{ groupId: string }>> {
  const t = await getTranslations("Group.settings.errors");
  const parsed = groupSettingsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  const { texts, externalId, isPublic, publicStats, detaining, passMode } = parsed.data;
  try {
    await apiPost(
      "/v1/groups/{id}",
      {
        localizedTexts: texts.filter((text) => text.name.trim() !== ""),
        externalId,
        isPublic,
        publicStats,
        detaining,
        ...(passMode === "threshold" && { threshold: parsed.data.threshold }),
        ...(passMode === "pointsLimit" && { pointsLimit: parsed.data.pointsLimit }),
      },
      { pathParams: { id: groupId } },
    );
    return { success: true, data: { groupId } };
  } catch (error) {
    return failure(error, "updateFailed");
  }
}

/** Organizational groups hold other groups and may hold neither students nor assignments -- which
 *  is why core-api refuses the flag on a group that already has either. */
export async function setGroupOrganizational(
  groupId: string,
  value: boolean,
): Promise<ActionResult<{ value: boolean }>> {
  try {
    await apiPost("/v1/groups/{id}/organizational", { value }, { pathParams: { id: groupId } });
    return { success: true, data: { value } };
  } catch (error) {
    return failure(error, "typeFailed");
  }
}

/** The group's *exam flag* -- how it is listed and archived -- which is a different thing from the
 *  exam terms S-008 sets, as the legacy screen says in as many words. */
export async function setGroupExamFlag(
  groupId: string,
  value: boolean,
): Promise<ActionResult<{ value: boolean }>> {
  try {
    await apiPost("/v1/groups/{id}/exam", { value }, { pathParams: { id: groupId } });
    return { success: true, data: { value } };
  } catch (error) {
    return failure(error, "typeFailed");
  }
}

/** Archiving a group freezes it and moves it to the archive; unarchiving is the same call, which
 *  is the action S-011 deliberately left to this ticket. */
export async function setGroupArchived(
  groupId: string,
  value: boolean,
): Promise<ActionResult<{ value: boolean }>> {
  try {
    await apiPost("/v1/groups/{id}/archived", { value }, { pathParams: { id: groupId } });
    return { success: true, data: { value } };
  } catch (error) {
    return failure(error, "archiveFailed");
  }
}

export async function relocateGroup(
  groupId: string,
  newParentId: string,
): Promise<ActionResult<{ newParentId: string }>> {
  try {
    await apiPost("/v1/groups/{id}/relocate/{newParentId}", undefined, {
      pathParams: { id: groupId, newParentId },
    });
    return { success: true, data: { newParentId } };
  } catch (error) {
    return failure(error, "relocateFailed");
  }
}

/** Removal is offered only for a group with no subgroups and a parent to fall back to, the same
 *  two conditions the legacy button disables itself on; core-api enforces both regardless. */
export async function deleteGroup(groupId: string): Promise<ActionResult<{ groupId: string }>> {
  try {
    await apiDelete("/v1/groups/{id}", { pathParams: { id: groupId } });
    return { success: true, data: { groupId } };
  } catch (error) {
    return failure(error, "deleteFailed");
  }
}

export async function addGroupStudent(
  groupId: string,
  userId: string,
): Promise<ActionResult<{ userId: string }>> {
  try {
    await apiPost("/v1/groups/{id}/students/{userId}", undefined, {
      pathParams: { id: groupId, userId },
    });
    return { success: true, data: { userId } };
  } catch (error) {
    return failure(error, "memberFailed");
  }
}

export async function removeGroupStudent(
  groupId: string,
  userId: string,
): Promise<ActionResult<{ userId: string }>> {
  try {
    await apiDelete("/v1/groups/{id}/students/{userId}", {
      pathParams: { id: groupId, userId },
    });
    return { success: true, data: { userId } };
  } catch (error) {
    return failure(error, "memberFailed");
  }
}

/** Adding *and* changing a role are the same call: core-api's `addMember` takes the membership
 *  type and overwrites whatever the user held before (`admin`, `supervisor`, `observer`). */
export async function setGroupMember(
  groupId: string,
  userId: string,
  type: "admin" | "supervisor" | "observer",
): Promise<ActionResult<{ userId: string }>> {
  try {
    await apiPost(
      "/v1/groups/{id}/members/{userId}",
      { type },
      { pathParams: { id: groupId, userId } },
    );
    return { success: true, data: { userId } };
  } catch (error) {
    return failure(error, "memberFailed");
  }
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
): Promise<ActionResult<{ userId: string }>> {
  try {
    await apiDelete("/v1/groups/{id}/members/{userId}", {
      pathParams: { id: groupId, userId },
    });
    return { success: true, data: { userId } };
  } catch (error) {
    return failure(error, "memberFailed");
  }
}
