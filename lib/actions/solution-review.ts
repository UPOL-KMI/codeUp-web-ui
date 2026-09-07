"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

import { reviewCommentSchema, type ReviewCommentValues } from "./solution-review.schema";

/**
 * Reviewing a solution (S-018): the comments a teacher pins to a line, and opening or closing the
 * review that holds them.
 *
 * None of these check whether the caller may review. core-api's `canAddReviewComment` /
 * `canReview` / `canDeleteReviewComment` decide that on every call, and they are the boundary --
 * a Server Action is a public HTTP endpoint whatever the UI rendered (brief §6). What the UI does
 * with `permissionHints` is decide what to *offer*; refusal is core-api's answer, surfaced here as
 * the form-level error.
 *
 * **No `revalidatePath`.** Every read in this app goes through `lib/api/client.ts`, which is
 * `cache: "no-store"` unconditionally (DEC-021) -- there is no cached page entry to invalidate.
 * The caller refreshes the router after a successful action, which re-runs the Server Component
 * and fetches the review again.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("Review.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

function validate(values: ReviewCommentValues) {
  const parsed = reviewCommentSchema.safeParse(values);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.join(".");
    if (field) fieldErrors[field] = issue.message;
  }
  return { ok: false as const, fieldErrors };
}

export async function addReviewComment(
  solutionId: string,
  file: string,
  line: number,
  values: ReviewCommentValues,
): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("Review.errors");
  const parsed = validate(values);
  if (!parsed.ok)
    return { success: false, formError: t("invalid"), fieldErrors: parsed.fieldErrors };

  try {
    const comment = await apiPost<{ id: string }>(
      "/v1/assignment-solutions/{id}/review-comment",
      { ...parsed.data, file, line },
      { pathParams: { id: solutionId } },
    );
    return { success: true, data: { id: comment.id } };
  } catch (error) {
    return failure(error, "addFailed");
  }
}

export async function updateReviewComment(
  solutionId: string,
  commentId: string,
  values: ReviewCommentValues,
): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("Review.errors");
  const parsed = validate(values);
  if (!parsed.ok)
    return { success: false, formError: t("invalid"), fieldErrors: parsed.fieldErrors };

  try {
    await apiPost("/v1/assignment-solutions/{id}/review-comment/{commentId}", parsed.data, {
      pathParams: { id: solutionId, commentId },
    });
    return { success: true, data: { id: commentId } };
  } catch (error) {
    return failure(error, "updateFailed");
  }
}

export async function deleteReviewComment(
  solutionId: string,
  commentId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    await apiDelete("/v1/assignment-solutions/{id}/review-comment/{commentId}", {
      pathParams: { id: solutionId, commentId },
    });
    return { success: true, data: { id: commentId } };
  } catch (error) {
    return failure(error, "deleteFailed");
  }
}

/**
 * Closing a review is what publishes it: core-api counts the issues at that moment, and it is what
 * makes the comments visible to the student (`visibleReviewComments()`). Reopening reverses both.
 */
export async function setReviewClosed(
  solutionId: string,
  close: boolean,
): Promise<ActionResult<{ closed: boolean }>> {
  try {
    await apiPost(
      "/v1/assignment-solutions/{id}/review",
      { close },
      { pathParams: { id: solutionId } },
    );
    return { success: true, data: { closed: close } };
  } catch (error) {
    return failure(error, "stateFailed");
  }
}

/**
 * Closing every review left open on one student's solutions at once (T-005), which is what the
 * legacy group-user-solutions page offers and the only thing on that screen that writes.
 *
 * One request per solution, because core-api has no bulk form -- and deliberately
 * `Promise.allSettled` rather than `Promise.all`: a reader may hold `review` on some of these
 * solutions and not on others, and one refusal should not abandon the rest half-closed. The count
 * that came back is what the caller reports; the page re-reads its list afterwards either way, so
 * what the reader ends up looking at is the truth rather than this function's summary of it.
 *
 * Which solutions are eligible is decided by the page from each solution's own `review` hint;
 * core-api re-decides it per call, as it does for the single-solution control (S-018).
 */
export async function closePendingReviews(
  solutionIds: string[],
): Promise<ActionResult<{ closed: number }>> {
  const results = await Promise.allSettled(
    solutionIds.map((solutionId) =>
      apiPost(
        "/v1/assignment-solutions/{id}/review",
        { close: true },
        { pathParams: { id: solutionId } },
      ),
    ),
  );

  const refused = results.find((result) => result.status === "rejected");
  if (refused) return failure(refused.reason, "stateFailed");
  return { success: true, data: { closed: results.length } };
}

/** Erases the review and every comment in it -- core-api refuses unless the caller may delete each
 *  comment individually, which is why this is offered only where `deleteReview` is granted. */
export async function deleteReview(solutionId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await apiDelete("/v1/assignment-solutions/{id}/review", {
      pathParams: { id: solutionId },
    });
    return { success: true, data: { id: solutionId } };
  } catch (error) {
    return failure(error, "deleteReviewFailed");
  }
}

/**
 * Ask for a review, or take the request back (G-003).
 *
 * **The one thing on a solution a student may change about the review.** core-api's `checkSetFlag`
 * treats `reviewRequest` as the weaker case -- `setFlagAsStudent` *or* `setFlag` -- where
 * `accepted` demands `setFlag` outright; verified live, where the author toggled this flag and was
 * refused `accepted` with a 403 in the same breath.
 *
 * It is also **unique per author per assignment**, like `accepted`: core-api clears the request from
 * the author's other attempts before setting it here. That is the behaviour a student wants (asking
 * about this attempt withdraws the question about the last one) and it needs no confirmation,
 * because it moves the student's own request rather than anybody else's.
 *
 * This is what fills the teacher's "reviews students have asked for" queue, which S-002 built on the
 * dashboard and which nothing in this app could put a solution into until now.
 */
export async function setReviewRequested(
  solutionId: string,
  value: boolean,
): Promise<ActionResult<{ solutionId: string }>> {
  const t = await getTranslations("Review.errors");
  try {
    await apiPost(
      "/v1/assignment-solutions/{id}/set-flag/{flag}",
      { value },
      { pathParams: { id: solutionId, flag: "reviewRequest" } },
    );
    return { success: true, data: { solutionId } };
  } catch (error) {
    return {
      success: false,
      formError: error instanceof ApiError ? error.message : t("requestFailed"),
    };
  }
}
