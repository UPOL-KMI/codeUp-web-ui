"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

/**
 * Writing in a discussion thread (T-022).
 *
 * **Posting can create the thread**, because a thread's id is the discussed entity's own and
 * core-api makes one on first use -- so there is no "create the discussion" call and none is
 * needed here.
 *
 * **Who may delete or unhide somebody else's comment is core-api's rule and is not reproduced
 * here**: `comment.isAuthor` *or* being a supervisor in the group of the commented solution or
 * assignment, and no hint for it rides on a comment. So the screens offer these where they have a
 * basis -- the reader's own comments always, everybody's where the page already knows the reader
 * teaches there -- and core-api decides for real (AGENTS.md constraint 4).
 *
 * Posting a comment **sends email to the thread's participants**, which core-api does itself. On
 * this deployment that mail is never delivered (Q-007), and this is one more place where that
 * matters: a private comment is the only kind that notifies nobody.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("Comments.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

export async function addComment(
  threadId: string,
  text: string,
  isPrivate: boolean,
): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("Comments.errors");
  const trimmed = text.trim();
  if (trimmed === "") return { success: false, formError: t("empty") };
  if (trimmed.length > 65535) return { success: false, formError: t("tooLong") };

  try {
    const comment = await apiPost<{ id: string }>(
      "/v1/comments/{id}",
      { text: trimmed, isPrivate },
      { pathParams: { id: threadId } },
    );
    return { success: true, data: { id: comment.id } };
  } catch (error) {
    return failure(error, "postFailed");
  }
}

export async function setCommentPrivacy(
  threadId: string,
  commentId: string,
  isPrivate: boolean,
): Promise<ActionResult<{ isPrivate: boolean }>> {
  try {
    // `.../private`, not the `/toggle` the legacy app uses: core-api marks that one deprecated,
    // and sending the value you want is not the same as flipping whatever is there.
    await apiPost(
      "/v1/comments/{threadId}/comment/{commentId}/private",
      { isPrivate },
      { pathParams: { threadId, commentId } },
    );
    return { success: true, data: { isPrivate } };
  } catch (error) {
    return failure(error, "privacyFailed");
  }
}

export async function deleteComment(
  threadId: string,
  commentId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    await apiDelete("/v1/comments/{threadId}/comment/{commentId}", {
      pathParams: { threadId, commentId },
    });
    return { success: true, data: { id: commentId } };
  } catch (error) {
    return failure(error, "deleteFailed");
  }
}
