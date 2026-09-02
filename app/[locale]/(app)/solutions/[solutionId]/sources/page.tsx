import { getLocale, getTranslations } from "next-intl/server";

import { ApiError } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/current-user";
import {
  canDisplayFiles,
  getFileContent,
  getSolutionFiles,
  MAX_DISPLAYED_FILES,
  type FileContent,
} from "@/lib/api/solution-files";
import { getSolutionDetail } from "@/lib/api/solution";
import {
  getSolutionReview,
  groupCommentsByFile,
  visibleReviewComments,
  type SolutionReview,
} from "@/lib/api/solution-review";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";
import { Discussion } from "@/components/comments/discussion";
import { EmptyState } from "@/components/state/empty-state";
import { ReviewControls } from "@/components/solutions/review-controls";
import { ReviewSummary } from "@/components/solutions/review-summary";
import { fileAnchorId, SourceFile } from "@/components/solutions/source-file";

const EMPTY_REVIEW: SolutionReview = { comments: [], startedAt: null, closedAt: null };

/**
 * The solution's source code (S-017) and its review (S-018) -- `docs/IA.md` §4.4's right column,
 * given its own route (`/solutions/:id/sources`) exactly as §2 lays it out.
 *
 * A separate page rather than a second column on the solution screen, and that is the IA's own
 * split: the evaluation answers "what happened", the sources answer "what did I write, and what
 * did my teacher say about it". They are read at different moments, they are each long, and only
 * one of them is worth linking someone directly to a line of.
 *
 * **Who sees the comments is not who may fetch them.** core-api discloses a review to the
 * solution's author as soon as one exists; the legacy app shows the author nothing until the
 * review is closed, and `visibleReviewComments()` keeps that rule -- a half-written review is not
 * a verdict. What the *reviewer* may do comes from `permissionHints` and is re-checked by core-api
 * on every write.
 */
export default async function SolutionSourcesPage({
  params,
}: {
  params: Promise<{ solutionId: string }>;
}) {
  const [{ solutionId }, locale] = await Promise.all([params, getLocale()]);
  const [t, tComments, solution, files, currentUser] = await Promise.all([
    getTranslations("Sources"),
    getTranslations("Comments"),
    getSolutionDetail(solutionId, locale),
    getSolutionFiles(solutionId),
    getCurrentUser(),
  ]);
  const breadcrumbs = await resolveBreadcrumbs(`/solutions/${solutionId}/sources`, locale);

  const canReview = solution.can.review === true;
  const review = solution.can.viewReview ? await getSolutionReview(solutionId) : EMPTY_REVIEW;
  // A comment can only be added to a review that has been opened -- the legacy rule, and the one
  // that keeps "start a review" a deliberate act rather than a side effect of typing.
  const canComment = solution.can.addReviewComment === true && review.startedAt !== null;
  const comments = visibleReviewComments(review, canReview);
  const grouped = groupCommentsByFile(
    comments,
    files.map((file) => file.name),
  );
  const canModerate = solution.groupPrimaryAdminIds.includes(currentUser.id);

  const displayable = canDisplayFiles(files);
  const contents = displayable
    ? await Promise.all(
        files.map(async (file): Promise<{ content: FileContent | null; error?: string }> => {
          try {
            return { content: await getFileContent(file.fileId, file.entry) };
          } catch (error) {
            // One unreadable file must not cost the reader the other thirty-one.
            return { content: null, error: error instanceof ApiError ? error.message : undefined };
          }
        }),
      )
    : [];

  return (
    <PageShell
      title={t("title")}
      subtitle={`${solution.assignmentName} — ${t("attempt", { attempt: solution.attemptIndex })}`}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ReviewControls
            solutionId={solutionId}
            startedAt={review.startedAt}
            closedAt={review.closedAt}
            canReview={canReview}
            canDeleteReview={solution.can.deleteReview === true}
          />
          <a
            href={`/api/solutions/${solutionId}/download`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("download")}
          </a>
          <Link
            href={`/solutions/${solutionId}`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("backToSolution")}
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        {canReview && review.startedAt !== null && review.closedAt === null && (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            {t("reviewOpenNote")}
          </p>
        )}
        {canReview && review.closedAt !== null && (
          <p className="rounded-lg border border-success bg-success/10 p-4 text-sm">
            {t("reviewClosedNote")}
          </p>
        )}
        {!canReview && solution.authorId === currentUser.id && review.closedAt !== null && (
          <p
            className={`rounded-lg border p-4 text-sm ${
              solution.reviewIssues > 0
                ? "border-warning bg-warning/10"
                : "border-success bg-success/10"
            }`}
          >
            {solution.reviewIssues > 0
              ? t("reviewedWithIssues", { issues: solution.reviewIssues })
              : t("reviewedNoIssues")}
          </p>
        )}

        <ReviewSummary
          solutionId={solutionId}
          comments={grouped.get("") ?? []}
          canComment={canComment}
          canModerate={canModerate}
          currentUserId={currentUser.id}
          reviewClosed={review.closedAt !== null}
        />

        {files.length === 0 ? (
          <EmptyState title={t("empty.title")} description={t("empty.description")} />
        ) : !displayable ? (
          <EmptyState
            title={t("tooMany.title")}
            description={t("tooMany.description", {
              count: files.length,
              max: MAX_DISPLAYED_FILES,
            })}
          />
        ) : (
          <>
            {files.length > 1 && (
              <nav aria-label={t("fileListLabel")} className="flex flex-wrap gap-2">
                {files.map((file) => (
                  <a
                    key={file.name}
                    href={`#${fileAnchorId(file.name)}`}
                    className="rounded-md border border-input px-2 py-1 font-mono text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {file.name}
                  </a>
                ))}
              </nav>
            )}
            <div className="flex flex-col gap-6">
              {files.map((file, index) => (
                <SourceFile
                  key={file.name}
                  solutionId={solutionId}
                  file={file}
                  content={contents[index]?.content ?? null}
                  contentError={contents[index]?.error}
                  comments={grouped.get(file.name) ?? []}
                  canComment={canComment}
                  canModerate={canModerate}
                  currentUserId={currentUser.id}
                  reviewClosed={review.closedAt !== null}
                />
              ))}
            </div>
          </>
        )}

        {/* The **solution's** thread, the same one its own screen shows -- the legacy app mounts
            it in both places, and the sources are where a remark about the code belongs. Not the
            same thing as S-018's inline review comments, which are attached to a line. */}
        <Discussion
          threadId={solutionId}
          publicMeans={tComments("audience.solution")}
          canModerate={solution.can.review === true}
        />
      </div>
    </PageShell>
  );
}
