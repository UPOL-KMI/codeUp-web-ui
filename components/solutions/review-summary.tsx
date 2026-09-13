"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { addReviewComment } from "@/lib/actions/solution-review";
import type { ReviewComment } from "@/lib/api/solution-review";

import { ReviewCommentForm, ReviewCommentItem } from "@/components/solutions/review-comment";
import { buttonClasses } from "@/components/button";

/**
 * Review comments that are not pinned to a line (S-018): core-api stores them with an empty file
 * and line zero, and the legacy app calls the same thing a review summary.
 *
 * This is also where a comment lands when the file it pointed at is no longer part of the solution
 * -- `groupCommentsByFile()` puts unmatched comments here rather than dropping them, since a
 * comment nobody can see is worse than one shown slightly out of place.
 */
export function ReviewSummary({
  solutionId,
  comments,
  bodies,
  canComment,
  canModerate,
  currentUserId,
  reviewClosed,
}: {
  solutionId: string;
  comments: ReviewComment[];
  /** Each comment's markdown, rendered on the server -- see `review-comment.tsx` (G-027). */
  bodies: Record<string, React.ReactNode>;
  canComment: boolean;
  canModerate: boolean;
  currentUserId: string;
  reviewClosed: boolean;
}) {
  const t = useTranslations("Review");
  const [adding, setAdding] = useState(false);

  if (!canComment && comments.length === 0) return null;

  return (
    <section aria-labelledby="review-summary" className="flex flex-col gap-3">
      <h2 id="review-summary" className="text-base font-semibold tracking-tight">
        {t("summary.heading")}
      </h2>
      {comments.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">{t("summary.empty")}</p>
      )}
      <div className="flex flex-col gap-2">
        {comments.map((comment) => (
          <ReviewCommentItem
            key={comment.id}
            solutionId={solutionId}
            comment={comment}
            body={bodies[comment.id]}
            canModify={canComment && (canModerate || comment.authorId === currentUserId)}
            reviewClosed={reviewClosed}
          />
        ))}
      </div>
      {canComment &&
        (adding ? (
          <div className="rounded-md border border-border bg-card">
            <ReviewCommentForm
              submitLabel={t("comment.add")}
              reviewClosed={reviewClosed}
              onCancel={() => setAdding(false)}
              onSubmitValues={(values) => addReviewComment(solutionId, "", 0, values)}
              onDone={() => setAdding(false)}
            />
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={buttonClasses("outline", "sm")}
            >
              {t("summary.add")}
            </button>
          </div>
        ))}
    </section>
  );
}
