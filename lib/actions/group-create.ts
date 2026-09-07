"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiPost } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/current-user";
import type { ActionResult } from "@/lib/forms/action-result";

import { createGroupSchema, type CreateGroupValues } from "./group-create.schema";

/**
 * Bringing a group into existence (G-008) -- the one thing the hierarchy could not do until now:
 * it could be read, renamed, moved, archived and deleted, and never extended.
 *
 * **`parentGroupId` is omitted rather than guessed for a top-level group.** core-api's
 * `actionAddGroup` reads it as "no parent given, so use this instance's root group", and then runs
 * its ACL check against whichever parent it resolved -- so omitting it is not a special case here,
 * it is the endpoint's own way of saying "under the instance". Passing a root group's id explicitly
 * would mean this app deciding which root, and it has no way to know (see below).
 *
 * As everywhere else, this does not check whether the caller may do it: `canAddSubgroup` on the
 * resolved parent is core-api's call on every request, and a Server Action is a public HTTP
 * endpoint whatever the UI rendered (brief §6). The hints decide what is offered.
 */
export async function createGroup(
  parentGroupId: string | null,
  values: CreateGroupValues,
): Promise<ActionResult<{ groupId: string }>> {
  const t = await getTranslations("Groups.create.errors");
  const parsed = createGroupSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  const user = await getCurrentUser();
  const instanceId = user.instanceIds[0];
  if (instanceId === undefined) return { success: false, formError: t("noInstance") };

  try {
    const created = await apiPost<{ id: string }>("/v1/groups", {
      // Required even when a parent is given, and a group's payload does not publish which
      // instance it belongs to -- so a subgroup is created in the *reader's* instance rather than
      // in its parent's, which core-api does not cross-check. Q-024.
      instanceId,
      ...(parentGroupId !== null && { parentGroupId }),
      localizedTexts: parsed.data.texts.filter((text) => text.name.trim() !== ""),
    });
    return { success: true, data: { groupId: created.id } };
  } catch (error) {
    return {
      success: false,
      formError: error instanceof ApiError ? error.message : t("createFailed"),
    };
  }
}
