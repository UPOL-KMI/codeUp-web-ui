"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { addReviewComment } from "@/lib/actions/solution-review";
import type { CodeToken } from "@/lib/code/highlight";
import type { ReviewComment } from "@/lib/api/solution-review";

import { AnnotatedCodeBlock, CodeLine } from "@/components/code/code-block";
import { ReviewCommentForm, ReviewCommentItem } from "@/components/solutions/review-comment";

/**
 * A file's source with its review comments threaded into it (S-018), and `docs/IA.md` §4.4's
 * "review comments anchor to these IDs via a client-side island".
 *
 * The island receives **tokens, not a highlighter**: the colouring was done on the server
 * (`highlightToLines`), so what crosses the boundary is plain data and no grammar, theme or
 * highlighter follows it (brief §4). It re-renders the same `CodeLine` the plain viewer uses, so
 * the two cannot look different, and it owns the interleaving -- which is the whole reason this is
 * a client component at all: a comment thread and a comment form have to appear *between* two
 * lines, in a place server-rendered HTML cannot be given to a child.
 *
 * Adding a comment: a per-line button in the gutter, plus double-clicking the line (the legacy
 * app's own gesture). The button exists because the double-click does not: a gesture no keyboard
 * can perform is not an affordance, and this is the screen where a teacher does most of their
 * work.
 *
 * Every control here is offered on `permissionHints` and enforced by core-api regardless -- a
 * hidden button is not authorisation (brief §3.4). `canModify` reproduces the legacy restriction
 * that a supervisor edits only their own comments while a group's primary admin edits any.
 */
export interface ReviewableCodeProps {
  solutionId: string;
  /** The comment's `file` key: `main.c`, or `archive.zip#src/main.c` for a ZIP entry. */
  fileName: string;
  lines: CodeToken[][];
  /** The block's distinct token styles; a token names one by index (PF-003). */
  palette: Record<string, string>[];
  rootStyle: Record<string, string>;
  idPrefix: string;
  comments: ReviewComment[];
  /** Each comment's markdown, rendered on the server -- see `review-comment.tsx` (G-027). */
  bodies: Record<string, React.ReactNode>;
  canComment: boolean;
  canModerate: boolean;
  currentUserId: string;
  reviewClosed: boolean;
}

export function ReviewableCode({
  solutionId,
  fileName,
  lines,
  palette,
  rootStyle,
  idPrefix,
  comments,
  bodies,
  canComment,
  canModerate,
  currentUserId,
  reviewClosed,
}: ReviewableCodeProps) {
  const t = useTranslations("Review");
  const code = useTranslations("Code");
  const [openLine, setOpenLine] = useState<number | null>(null);

  const byLine = new Map<number, ReviewComment[]>();
  for (const comment of comments) {
    const bucket = byLine.get(comment.line);
    if (bucket) bucket.push(comment);
    else byLine.set(comment.line, [comment]);
  }

  return (
    <AnnotatedCodeBlock rootStyle={rootStyle}>
      {lines.map((tokens, index) => {
        const line = index + 1;
        const lineComments = byLine.get(line) ?? [];
        return (
          <div key={line} className="code-line-group">
            <div
              className={canComment ? "code-line-commentable" : undefined}
              onDoubleClick={canComment ? () => setOpenLine(line) : undefined}
            >
              {canComment && (
                <button
                  type="button"
                  className="code-line-comment-button"
                  aria-label={t("comment.addOnLine", { line })}
                  onClick={() => setOpenLine(line)}
                >
                  +
                </button>
              )}
              <CodeLine
                tokens={tokens}
                palette={palette}
                number={line}
                idPrefix={idPrefix}
                label={code("lineLabel", { line })}
              />
            </div>

            {(lineComments.length > 0 || openLine === line) && (
              <div className="code-line-comments">
                {lineComments.map((comment) => (
                  <ReviewCommentItem
                    key={comment.id}
                    solutionId={solutionId}
                    comment={comment}
                    body={bodies[comment.id]}
                    canModify={canComment && (canModerate || comment.authorId === currentUserId)}
                    reviewClosed={reviewClosed}
                  />
                ))}
                {openLine === line && (
                  <div className="border-l-2 border-primary bg-card">
                    <ReviewCommentForm
                      submitLabel={t("comment.add")}
                      reviewClosed={reviewClosed}
                      onCancel={() => setOpenLine(null)}
                      onSubmitValues={(values) =>
                        addReviewComment(solutionId, fileName, line, values)
                      }
                      onDone={() => setOpenLine(null)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </AnnotatedCodeBlock>
  );
}
