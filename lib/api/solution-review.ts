import "server-only";

import { cache } from "react";

import { apiGet, apiPost } from "./client";

/**
 * A solution's review: the teacher's comments, each pinned to a file and a line (S-018).
 *
 * `GET /v1/assignment-solutions/{id}/review` returns the solution *and* every comment on it. The
 * solution half is already this app's `getSolutionDetail()`, so only the comments are kept here.
 *
 * **Who may read them is not the same question as who may fetch them.** core-api's `canViewReview`
 * is true for the solution's author from the moment a review exists, but the legacy app shows the
 * author nothing until the review is *closed* (`groupReviewCommentPerFile`, which discards every
 * comment when `!closed && !isSupervisor`). That is a deliberate product rule -- half a review, in
 * the middle of being written, is not a verdict anyone should act on -- and this app reproduces
 * it in `visibleReviewComments()` rather than dropping it silently.
 */
export interface ReviewComment {
  id: string;
  /** Author's user id; null when the author's account has been deleted. */
  authorId: string | null;
  authorName: string;
  createdAt: number;
  /** File the comment is pinned to (`main.c`, `archive.zip#src/main.c`), or "" for the solution. */
  file: string;
  /** 1-based line; zero for a comment on the solution as a whole. */
  line: number;
  text: string;
  /** Issues are the comments the student is expected to act on. */
  issue: boolean;
}

export interface SolutionReview {
  comments: ReviewComment[];
  startedAt: number | null;
  closedAt: number | null;
}

interface ReviewCommentPayload {
  id: string;
  author: string | null;
  createdAt: number;
  file: string;
  line: number;
  text: string;
  issue: boolean;
}

interface ReviewPayload {
  solution: { review: { startedAt: number; closedAt: number | null } | null };
  reviewComments: ReviewCommentPayload[];
}

export const getSolutionReview = cache(async function getSolutionReview(
  solutionId: string,
): Promise<SolutionReview> {
  const payload = await apiGet<ReviewPayload>("/v1/assignment-solutions/{id}/review", {
    pathParams: { id: solutionId },
  });

  const authorIds = [
    ...new Set(payload.reviewComments.map((comment) => comment.author).filter((id) => id !== null)),
  ];
  const authors =
    authorIds.length > 0
      ? await apiPost<{ id: string; fullName: string }[]>("/v1/users/list", { ids: authorIds })
      : [];
  const names = new Map(authors.map((author) => [author.id, author.fullName]));

  return {
    startedAt: payload.solution.review?.startedAt ?? null,
    closedAt: payload.solution.review?.closedAt ?? null,
    comments: payload.reviewComments
      .map((comment) => ({
        id: comment.id,
        authorId: comment.author,
        authorName: comment.author ? (names.get(comment.author) ?? "") : "",
        createdAt: comment.createdAt,
        file: comment.file,
        line: comment.line,
        text: comment.text,
        issue: comment.issue,
      }))
      .sort((a, b) => a.createdAt - b.createdAt),
  };
});

/**
 * What this reader may actually see, per the rule described above: everything once the review is
 * closed, nothing before that unless they are the one writing it.
 */
export function visibleReviewComments(review: SolutionReview, canReview: boolean): ReviewComment[] {
  if (review.closedAt !== null || canReview) return review.comments;
  return [];
}

/** Comments grouped by the file they are pinned to; the "" key holds solution-wide comments and
 *  any comment whose file is no longer part of the solution. */
export function groupCommentsByFile(
  comments: ReviewComment[],
  fileNames: string[],
): Map<string, ReviewComment[]> {
  const known = new Set(fileNames);
  const grouped = new Map<string, ReviewComment[]>();
  grouped.set("", []);
  for (const name of fileNames) grouped.set(name, []);
  for (const comment of comments) {
    const key = known.has(comment.file) ? comment.file : "";
    grouped.get(key)!.push(comment);
  }
  return grouped;
}
