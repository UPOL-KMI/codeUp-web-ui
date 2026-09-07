import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getSolutionDetail } from "@/lib/api/solution";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { formatPoints } from "@/lib/format/points";
import { evaluationStatus } from "@/lib/status/evaluation";

import { Link } from "@/i18n/navigation";
import { EvaluationProgress } from "@/components/solutions/evaluation-progress";
import { EvaluationResults } from "@/components/solutions/evaluation-results";
import { VerdictControls } from "@/components/solutions/verdict-controls";
import { DateTime } from "@/components/format/date-time";
import { RelativeTime } from "@/components/format/relative-time";
import { PageShell } from "@/components/page-shell";
import { Discussion } from "@/components/comments/discussion";
import { Badge } from "@/components/status/badge";
import { EvaluationBadge } from "@/components/status/evaluation-badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Solution" });
  return { title: t("pageTitle") };
}

/**
 * A submitted solution and its evaluation (S-015) -- where submitting lands, and where every
 * "Attempt N" link goes.
 *
 * `docs/IA.md` §4.4 describes two columns, evaluation beside source code. This builds the
 * evaluation one; the source viewer is S-017 and the inline review comments S-018, both of which
 * hang off the same page. Splitting them that way keeps each ticket's screen usable on its own
 * rather than shipping half of a two-column layout.
 *
 * Nothing here re-derives what the reader may see. Core-api nulls measured values, limit ratios and
 * judge logs per assignment flag, and `permissionHints` says whether they may set the review
 * request or the accepted flag -- this page renders what arrived.
 *
 * `?monitor=` (S-016) is the monitor channel of the job that is still running -- put there by the
 * submit form, since core-api hands the channel id out once, in the response to the submit that
 * created it, and never again. Without it the screen still updates itself; with it, it can say
 * which step the job is on.
 */
export default async function SolutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ solutionId: string }>;
  searchParams: Promise<{ monitor?: string; tasks?: string }>;
}) {
  const [{ solutionId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const [t, tComments, solution] = await Promise.all([
    getTranslations("Solution"),
    getTranslations("Comments"),
    getSolutionDetail(solutionId, locale),
  ]);
  const breadcrumbs = await resolveBreadcrumbs(`/solutions/${solutionId}`, locale);
  const pending = evaluationStatus(solution.status) === "pending";
  const expectedTasks = Number.parseInt(query.tasks ?? "", 10);
  const announcement = solution.failure
    ? t("evaluation.announce.failed")
    : !solution.evaluation
      ? t("evaluation.announce.pending")
      : solution.evaluation.initFailed
        ? t("evaluation.announce.initFailed")
        : t("evaluation.announce.done", {
            passed: solution.evaluation.testResults.filter((result) => result.score >= 1).length,
            total: solution.evaluation.testResults.length,
          });

  return (
    <PageShell
      title={t("title", { attempt: solution.attemptIndex })}
      subtitle={solution.assignmentName}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {solution.isBest && <Badge tone="success">{t("flags.best")}</Badge>}
          {solution.accepted && <Badge tone="info">{t("flags.accepted")}</Badge>}
          {solution.reviewClosedAt !== null ? (
            <Badge>{t("flags.reviewed")}</Badge>
          ) : solution.reviewStartedAt !== null ? (
            <Badge tone="warning">{t("flags.reviewOpen")}</Badge>
          ) : solution.reviewRequested ? (
            <Badge tone="warning">{t("flags.reviewRequested")}</Badge>
          ) : null}
          {solution.plagiarismBatchId !== null && (
            <Link
              href={`/solutions/${solutionId}/plagiarisms`}
              className="rounded-md border border-warning/60 px-3 py-1.5 text-sm text-foreground hover:bg-warning/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("plagiarisms")}
            </Link>
          )}
          <Link
            href={`/solutions/${solutionId}/sources`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("sourceCode")}
          </Link>
          <Link
            href={`/assignments/${solution.assignmentId}`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("backToAssignment")}
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        <section aria-labelledby="solution-summary">
          <h2 id="solution-summary" className="mb-3 text-base font-semibold tracking-tight">
            {t("summary")}
          </h2>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-border py-2">
              <dt className="text-sm text-muted-foreground">{t("points")}</dt>
              <dd className="text-sm font-medium tabular-nums">
                {formatPoints(solution.gained ?? 0, solution.maxPoints)}
                {solution.bonus !== 0 && (
                  <span className={solution.bonus > 0 ? "text-success" : "text-destructive"}>
                    {solution.bonus > 0 ? ` +${solution.bonus}` : ` ${solution.bonus}`}
                  </span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border py-2">
              <dt className="text-sm text-muted-foreground">{t("result")}</dt>
              <dd>
                <EvaluationBadge solution={solution.status} />
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border py-2">
              <dt className="text-sm text-muted-foreground">{t("submitted")}</dt>
              <dd className="flex flex-wrap items-center gap-2 text-sm">
                <DateTime unixSeconds={solution.createdAt} withSeconds />
                <span className="text-muted-foreground">
                  <RelativeTime unixSeconds={solution.createdAt} />
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border py-2">
              <dt className="text-sm text-muted-foreground">{t("environment")}</dt>
              <dd className="text-sm">{solution.environment}</dd>
            </div>
            {solution.groupId && (
              <div className="flex justify-between gap-4 border-b border-border py-2">
                <dt className="text-sm text-muted-foreground">{t("group")}</dt>
                <dd className="text-sm">
                  <Link
                    href={`/groups/${solution.groupId}`}
                    className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {solution.groupName}
                  </Link>
                </dd>
              </div>
            )}
            {solution.submissionCount > 1 && (
              <div className="flex justify-between gap-4 border-b border-border py-2">
                <dt className="text-sm text-muted-foreground">{t("submissions")}</dt>
                {/* Resubmissions are a teacher's tool: the same solution re-run against the
                    pipeline. Only the count is shown here -- listing them is T-003's screen. */}
                <dd className="text-sm tabular-nums">{solution.submissionCount}</dd>
              </div>
            )}
            {solution.note && (
              <div className="flex justify-between gap-4 border-b border-border py-2 sm:col-span-2">
                <dt className="text-sm text-muted-foreground">{t("note")}</dt>
                <dd className="text-sm">{solution.note}</dd>
              </div>
            )}
          </dl>
        </section>

        <VerdictControls
          solutionId={solution.id}
          accepted={solution.accepted}
          overridden={solution.overridden}
          bonus={solution.bonus}
          maxPoints={solution.maxPoints}
          canAccept={solution.can.setFlag === true}
          canSetPoints={solution.can.setBonusPoints === true}
        />

        <section aria-labelledby="solution-evaluation">
          <h2 id="solution-evaluation" className="mb-3 text-base font-semibold tracking-tight">
            {t("evaluation.heading")}
          </h2>
          {/* Outside `pending`, so the region is still mounted when the result replaces the
              progress island -- a live region inserted with its content announces nothing. */}
          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>
          {pending && (
            <div className="mb-4">
              <EvaluationProgress
                channelId={query.monitor ?? null}
                monitorUrl={process.env.MONITOR_WS_URL ?? null}
                expectedTasks={Number.isFinite(expectedTasks) ? expectedTasks : 0}
              />
            </div>
          )}
          <EvaluationResults solution={solution} />
        </section>

        <Discussion
          threadId={solutionId}
          publicMeans={tComments("audience.solution")}
          canModerate={solution.can.review === true}
        />
      </div>
    </PageShell>
  );
}
