"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import { fromDateTimeLocal } from "@/lib/format/datetime-local";
import type { ActionResult } from "@/lib/forms/action-result";

import { systemMessageSchema, type SystemMessageValues } from "./system-messages.schema";

/**
 * Writing, changing and withdrawing a broadcast (AD-007).
 *
 * **Creating one is a supervisor's, not only a superadmin's** -- `permissions.neon` grants
 * `notification.create` from the `supervisor` role up, and `update`/`remove` to the message's
 * author or an admin of a group it targets. Listing *every* message (`/all`) is the superadmin's
 * alone, which is the one thing that keeps the management screen narrower than the capability
 * behind it (DEC-115).
 *
 * **Update is a replace, not a patch**: core-api's update endpoint requires the same full body as
 * create, so the editor always sends every field and the action never merges.
 *
 * No `revalidatePath` (DEC-021): every read is `no-store`, and the caller refreshes the router.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("SystemMessages.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

interface MessageBody {
  groupsIds: string[];
  visibleFrom: number;
  visibleTo: number;
  role: string;
  type: string;
  localizedTexts: { locale: string; text: string }[];
}

async function body(
  values: SystemMessageValues,
): Promise<{ body: MessageBody } | { error: ActionResult<never> }> {
  const t = await getTranslations("SystemMessages.errors");
  const parsed = systemMessageSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: {
        success: false,
        formError: t(
          issue?.message === "textRequired"
            ? "textRequired"
            : issue?.message === "endsBeforeItStarts"
              ? "endsBeforeItStarts"
              : "invalid",
        ),
      },
    };
  }

  const visibleFrom = fromDateTimeLocal(parsed.data.visibleFrom);
  const visibleTo = fromDateTimeLocal(parsed.data.visibleTo);
  if (visibleFrom === null || visibleTo === null) {
    return { error: { success: false, formError: t("badDate") } };
  }

  return {
    body: {
      // Always global. Targeting a message at groups is a capability core-api has and the legacy
      // editor never exposes either -- its form has no group control at all, and `groupsIds` goes
      // out empty (T-024's shape: an unexposed field is not a dropped feature until somebody can
      // point at where it was exposed).
      groupsIds: [],
      visibleFrom,
      visibleTo,
      role: parsed.data.role,
      type: parsed.data.type,
      // A language left blank is a language this message is not written in, and core-api takes the
      // array as given -- so the empty ones are dropped rather than stored as empty strings.
      localizedTexts: parsed.data.texts.filter((text) => text.text.trim() !== ""),
    },
  };
}

export async function createSystemMessage(
  values: SystemMessageValues,
): Promise<ActionResult<{ id: string }>> {
  const built = await body(values);
  if ("error" in built) return built.error;

  try {
    const created = await apiPost<{ id: string }>("/v1/notifications", built.body);
    return { success: true, data: { id: created.id } };
  } catch (error) {
    return failure(error, "createFailed");
  }
}

export async function updateSystemMessage(
  messageId: string,
  values: SystemMessageValues,
): Promise<ActionResult<{ id: string }>> {
  const built = await body(values);
  if ("error" in built) return built.error;

  try {
    await apiPost("/v1/notifications/{id}", built.body, { pathParams: { id: messageId } });
    return { success: true, data: { id: messageId } };
  } catch (error) {
    return failure(error, "updateFailed");
  }
}

export async function deleteSystemMessage(
  messageId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    await apiDelete("/v1/notifications/{id}", { pathParams: { id: messageId } });
    return { success: true, data: { id: messageId } };
  } catch (error) {
    return failure(error, "deleteFailed");
  }
}

/**
 * Marking the broadcasts on screen as read.
 *
 * **There is no per-message read flag.** The legacy app stores a single timestamp in the reader's
 * own `uiData` (`systemMessagesAccepted`) and treats every message whose `visibleFrom` is older as
 * seen -- so "mark as read" is one number, not a list, and a message published afterwards comes
 * back on its own. This app keeps that exactly, because the alternative is inventing storage
 * core-api does not have.
 *
 * `POST /v1/users/{id}/ui-data` **merges** unless told to overwrite, so this writes the one key and
 * leaves whatever else the legacy app put there alone.
 */
export async function markSystemMessagesRead(
  userId: string,
  upTo: number,
): Promise<ActionResult<{ upTo: number }>> {
  try {
    await apiPost(
      "/v1/users/{id}/ui-data",
      { uiData: { systemMessagesAccepted: upTo } },
      { pathParams: { id: userId } },
    );
    return { success: true, data: { upTo } };
  } catch (error) {
    return failure(error, "readFailed");
  }
}
