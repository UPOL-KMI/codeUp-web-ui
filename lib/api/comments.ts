import "server-only";

import { cache } from "react";

import { ApiError, apiGet } from "./client";

/**
 * A discussion thread (T-022) -- the legacy `comments` module, and the one capability this app had
 * never built.
 *
 * **A thread's id is the id of the thing being discussed.** There is no separate entity to create
 * or look up: `/v1/comments/{exerciseId}` *is* the exercise's discussion, and core-api creates the
 * thread the first time anybody reads or writes it. That is why this screen needs no "start a
 * discussion" control and why an entity that has never been discussed simply has an empty thread.
 *
 * **A private comment is a note to oneself.** core-api filters the thread through
 * `filterPublic($user)` before sending it, so a comment somebody marked private is not in the
 * payload for anybody else at all -- this app never has to hide one, and could not leak one if it
 * tried. What "public" means differs by screen (a group's supervisors, the solution's author, the
 * teachers who can see a reference solution), so each mount point says so in its own words.
 */
export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  postedAt: number;
  isPrivate: boolean;
  text: string;
}

export interface CommentThread {
  id: string;
  comments: Comment[];
}

interface CommentPayload {
  id: string;
  commentThreadId: string;
  user?: { id: string; name: string } | null;
  postedAt: number;
  isPrivate: boolean;
  text: string;
}

/**
 * The thread, or `null` where the reader may not see it. A refusal is not an error here: a
 * discussion is one part of a screen, and taking the whole page down because core-api would not
 * show it is the trap `pageRead` exists to avoid on the *other* side.
 */
export const getCommentThread = cache(async function getCommentThread(
  threadId: string,
): Promise<CommentThread | null> {
  try {
    const thread = await apiGet<{ id: string; comments?: CommentPayload[] }>("/v1/comments/{id}", {
      pathParams: { id: threadId },
    });
    return {
      id: thread.id,
      comments: (thread.comments ?? [])
        .map((comment) => ({
          id: comment.id,
          authorId: comment.user?.id ?? "",
          authorName: comment.user?.name ?? "",
          postedAt: comment.postedAt,
          isPrivate: comment.isPrivate,
          text: comment.text,
        }))
        // Oldest first: a discussion is read in the order it happened.
        .sort((a, b) => a.postedAt - b.postedAt),
    };
  } catch (error) {
    if (error instanceof ApiError && error.httpStatus === 403) return null;
    throw error;
  }
});
