import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ApiError } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/current-user";
import {
  canDisplayFiles,
  getFileContent,
  getSolutionFiles,
  MAX_DISPLAYED_FILES,
  type FileContent,
  type SolutionFileEntry,
} from "@/lib/api/solution-files";
import { getSolutionDetail } from "@/lib/api/solution";
import {
  getSolutionReview,
  groupCommentsByFile,
  visibleReviewComments,
  type ReviewComment,
  type SolutionReview,
} from "@/lib/api/solution-review";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";
import { Discussion } from "@/components/comments/discussion";
import { Markdown } from "@/components/markdown/markdown";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorBoundary } from "@/components/state/error-boundary";
import { TableSkeleton } from "@/components/state/skeleton";
import { ComparePicker } from "@/components/solutions/compare-picker";
import { ReviewControls } from "@/components/solutions/review-controls";
import { ReviewSummary } from "@/components/solutions/review-summary";
import { fileAnchorId, SourceFile } from "@/components/solutions/source-file";

const EMPTY_REVIEW: SolutionReview = { comments: [], startedAt: null, closedAt: null };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Sources" });
  return { title: t("title") };
}

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
  const [t, tComments, status, solution, files, currentUser] = await Promise.all([
    getTranslations("Sources"),
    getTranslations("Comments"),
    getTranslations("Status"),
    getSolutionDetail(solutionId, locale),
    getSolutionFiles(solutionId),
    getCurrentUser(),
  ]);
  // The review cannot join the fetch above: whether it may be asked for at all is that fetch's own
  // answer, and asking without the hint is a refusal rather than an empty review.
  const [breadcrumbs, review] = await Promise.all([
    resolveBreadcrumbs(`/solutions/${solutionId}/sources`, locale),
    solution.can.viewReview ? getSolutionReview(solutionId) : EMPTY_REVIEW,
  ]);

  const canReview = solution.can.review === true;
  // A comment can only be added to a review that has been opened -- the legacy rule, and the one
  // that keeps "start a review" a deliberate act rather than a side effect of typing.
  const canComment = solution.can.addReviewComment === true && review.startedAt !== null;
  const comments = visibleReviewComments(review, canReview);
  const grouped = groupCommentsByFile(
    comments,
    files.map((file) => file.name),
  );
  const canModerate = solution.groupPrimaryAdminIds.includes(currentUser.id);

  // A review comment is authored markdown and is rendered as such (G-027). It has to happen here,
  // on the server: `Markdown` is an async Server Component and every component between this page
  // and the comment is a client island, because a comment thread appears *between* two lines of
  // code. One render per comment, handed down by id.
  const bodies = Object.fromEntries(
    comments.map((comment) => [comment.id, <Markdown key={comment.id} source={comment.text} />]),
  );

  const displayable = canDisplayFiles(files);

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
          bodies={bodies}
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
            <ErrorBoundary>
              <Suspense fallback={<TableSkeleton label={status("loading")} />}>
                <SourceFileList
                  solutionId={solutionId}
                  files={files}
                  comments={grouped}
                  bodies={bodies}
                  canComment={canComment}
                  canModerate={canModerate}
                  currentUserId={currentUser.id}
                  reviewClosed={review.closedAt !== null}
                />
              </Suspense>
            </ErrorBoundary>
          </>
        )}

        {/* Comparing is a teacher's tool: the list it offers is *other* attempts, which is exactly
            what `viewAssignmentSolutions` grants and what the solution's own `viewDetail` does not
            -- an author has that for their own work and must not be shown a picker whose reader
            would be refused. */}
        {solution.canViewSolutions && (
          <ComparePicker
            solutionId={solutionId}
            assignmentId={solution.assignmentId}
            authorId={solution.authorId}
          />
        )}

        {/* The **solution's** thread, the same one its own screen shows -- the legacy app mounts
            it in both places, and the sources are where a remark about the code belongs. Not the
            same thing as S-018's inline review comments, which are attached to a line. */}
        <ErrorBoundary>
          <Suspense fallback={<TableSkeleton label={status("loading")} />}>
            <Discussion
              threadId={solutionId}
              publicMeans={tComments("audience.solution")}
              canModerate={solution.can.review === true}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    </PageShell>
  );
}

/**
 * The submitted files themselves: one content read per file, then one server-side highlighting
 * pass per file. Both belong below a boundary rather than in the page -- everything above them
 * (the review, its notices, the file index) is ready long before as much as a megabyte of source
 * has been fetched and tokenised, and only this section has to wait for it.
 *
 * Which files these are, and whether they may be shown at all, is settled by the page above:
 * `canDisplayFiles` and the comment grouping stay there and arrive as props.
 */
async function SourceFileList({
  solutionId,
  files,
  comments,
  bodies,
  canComment,
  canModerate,
  currentUserId,
  reviewClosed,
}: {
  solutionId: string;
  files: SolutionFileEntry[];
  comments: Map<string, ReviewComment[]>;
  bodies: Record<string, React.ReactNode>;
  canComment: boolean;
  canModerate: boolean;
  currentUserId: string;
  reviewClosed: boolean;
}) {
  const contents = await Promise.all(
    files.map(async (file): Promise<{ content: FileContent | null; error?: string }> => {
      try {
        return { content: await getFileContent(file.fileId, file.entry) };
      } catch (error) {
        // One unreadable file must not cost the reader the other thirty-one.
        return { content: null, error: error instanceof ApiError ? error.message : undefined };
      }
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      {files.map((file, index) => (
        <SourceFile
          key={file.name}
          solutionId={solutionId}
          file={file}
          content={contents[index]?.content ?? null}
          contentError={contents[index]?.error}
          review={{
            comments: comments.get(file.name) ?? [],
            bodies,
            canComment,
            canModerate,
            currentUserId,
            reviewClosed,
          }}
        />
      ))}
    </div>
  );
}
