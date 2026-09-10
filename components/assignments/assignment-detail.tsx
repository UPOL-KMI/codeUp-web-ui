import { getFormatter, getTranslations } from "next-intl/server";

import type { AssignmentDetail } from "@/lib/api/assignment";

import { Link } from "@/i18n/navigation";
import { SolutionList } from "@/components/assignments/solution-list";
import { DateTime } from "@/components/format/date-time";
import { RelativeTime } from "@/components/format/relative-time";
import { Markdown } from "@/components/markdown/markdown";
import { EmptyState } from "@/components/state/empty-state";
import { Badge } from "@/components/status/badge";
import { DeadlineBadge } from "@/components/status/deadline-badge";

/**
 * An assignment as the person solving it sees it (S-012, `docs/IA.md` §4.3): what to do, by when,
 * for how many points, and what they have submitted so far.
 *
 * Whether submitting is possible right now is core-api's answer (`/can-submit`, which folds in the
 * deadline, the attempt limit, the group's licence, exam locks and a system-wide submission lock),
 * stated here in words. The button appears only when that answer is yes -- S-014 added the screen
 * behind it, and the real `POST .../submit` re-checks the same rule regardless of what this page
 * believed a moment ago.
 *
 * The attempt count deliberately reports **evaluated** solutions rather than submitted ones,
 * because that is what core-api counts against the limit (`findValidSolutions`) -- a submission
 * that died in the pipeline does not consume an attempt, and telling a student otherwise would
 * cost them one.
 *
 * Everything that speaks in the first person -- "you can submit", "my solutions" -- is rendered
 * only for someone who studies in this group (S-013). core-api answers `canSubmit: true` for a
 * supervisor as well, but the legacy app offers the button to students only, and a teacher who
 * reads "you have 20 attempts left" under an assignment they set is being told about a
 * submission nobody expects them to make.
 */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-0 sm:flex-row sm:gap-4">
      <dt className="text-sm text-muted-foreground sm:w-56 sm:shrink-0">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export async function AssignmentDetailView({ assignment }: { assignment: AssignmentDetail }) {
  const [t, format] = await Promise.all([getTranslations("Assignment"), getFormatter()]);

  const attemptsLeft = Math.max(
    0,
    assignment.submissionsCountLimit - assignment.submission.evaluated,
  );

  // `isPublic` alone, with the release date stated beside it rather than folded into it: whether
  // `visibleFrom` has passed depends on the current time, which a Server Component has no business
  // deciding (the same rule `DeadlineBadge` exists for).

  // A former student of the group still has their attempts; they just no longer have a deadline.
  const showMySolutions = assignment.viewerIsStudent || assignment.mySolutions.length > 0;

  return (
    <div className="flex flex-col gap-8">
      {assignment.viewerIsStudent && (
        <section aria-labelledby="assignment-submitting">
          <h2 id="assignment-submitting" className="mb-3 text-base font-semibold tracking-tight">
            {t("submitting.heading")}
          </h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm">
              {assignment.submission.lockedReason
                ? t("submitting.locked")
                : assignment.submission.canSubmit
                  ? t("submitting.open", { attempts: attemptsLeft })
                  : attemptsLeft === 0
                    ? t("submitting.noAttempts", { limit: assignment.submissionsCountLimit })
                    : t("submitting.closed")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("submitting.counts", {
                evaluated: assignment.submission.evaluated,
                failed: assignment.submission.failed,
              })}
            </p>
            {assignment.submission.canSubmit && (
              <p className="mt-3">
                <Link
                  href={`/assignments/${assignment.id}/submit`}
                  className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {t("submitAction")}
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="assignment-text">
        <h2 id="assignment-text" className="mb-3 text-base font-semibold tracking-tight">
          {t("text")}
        </h2>
        {assignment.text ? (
          <Markdown source={assignment.text} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("noText")}</p>
        )}
        {assignment.externalLink && (
          <p className="mt-3 text-sm">
            <a
              href={assignment.externalLink}
              rel="noreferrer noopener"
              target="_blank"
              className="underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("externalLink")}
            </a>
          </p>
        )}
        {assignment.studentHint && (
          <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
            <h3 className="text-sm font-medium">{t("hint")}</h3>
            {/* Markdown, not plain text: legacy renders the hint through its own renderer
                (`LocalizedTexts.js`), so a hint authored with a list or emphasis rendered here as
                literal asterisks. Found while building G-028 -- offering a markdown preview of a
                field displayed as plain text would have been the more visible half of the bug. */}
            <div className="mt-1">
              <Markdown source={assignment.studentHint} />
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="assignment-terms">
        <h2 id="assignment-terms" className="mb-3 text-base font-semibold tracking-tight">
          {t("terms")}
        </h2>
        <dl>
          <DetailRow label={t("firstDeadline")}>
            <span className="flex flex-wrap items-center gap-2">
              <DateTime unixSeconds={assignment.firstDeadline} />
              <span className="text-muted-foreground">
                <RelativeTime unixSeconds={assignment.firstDeadline} />
              </span>
              <DeadlineBadge
                firstDeadline={assignment.firstDeadline}
                secondDeadline={assignment.secondDeadline}
                allowSecondDeadline={assignment.allowSecondDeadline}
              />
              <span className="text-muted-foreground">
                {t("upToPoints", { points: assignment.maxPointsFirst })}
              </span>
            </span>
          </DetailRow>
          {assignment.secondDeadline !== null && (
            <DetailRow label={t("secondDeadline")}>
              <span className="flex flex-wrap items-center gap-2">
                <DateTime unixSeconds={assignment.secondDeadline} />
                <span className="text-muted-foreground">
                  {t("upToPoints", { points: assignment.maxPointsSecond })}
                </span>
              </span>
            </DetailRow>
          )}
          {assignment.pointsThreshold > 0 && (
            <DetailRow label={t("threshold")}>
              {t("thresholdNote", {
                percent: format.number(assignment.pointsThreshold / 100, {
                  style: "percent",
                  maximumFractionDigits: 1,
                }),
              })}
            </DetailRow>
          )}
          <DetailRow label={t("attempts")}>
            {t("attemptsValue", { limit: assignment.submissionsCountLimit })}
          </DetailRow>
          {assignment.can.update && (
            <DetailRow label={t("visibility")}>
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={assignment.isPublic ? "success" : "warning"}>
                  {assignment.isPublic ? t("visible") : t("notVisible")}
                </Badge>
                {assignment.visibleFrom !== null && (
                  <span className="text-muted-foreground">
                    {t("visibleFrom")} <DateTime unixSeconds={assignment.visibleFrom} />
                  </span>
                )}
              </span>
            </DetailRow>
          )}
          {assignment.can.update && (
            <DetailRow label={t("assignedAt")}>
              <span className="flex flex-wrap items-center gap-2">
                <DateTime unixSeconds={assignment.createdAt} />
                <span className="text-muted-foreground">
                  <RelativeTime unixSeconds={assignment.createdAt} />
                </span>
              </span>
            </DetailRow>
          )}
          {assignment.environments.length > 0 && (
            <DetailRow label={t("environments")}>{assignment.environments.join(", ")}</DetailRow>
          )}
          {assignment.solutionFilesLimit !== null && (
            <DetailRow label={t("filesLimit")}>{assignment.solutionFilesLimit}</DetailRow>
          )}
          {assignment.solutionSizeLimit !== null && (
            <DetailRow label={t("sizeLimit")}>
              {/* Kibibytes, as core-api stores them -- a "64 kB" that is really 65536 bytes is the
                  kind of rounding a student notices only when an upload is refused. */}
              {format.number(assignment.solutionSizeLimit / 1024, { maximumFractionDigits: 0 })} KiB
            </DetailRow>
          )}
        </dl>
      </section>

      {showMySolutions && (
        <section aria-labelledby="assignment-solutions">
          <h2 id="assignment-solutions" className="mb-3 text-base font-semibold tracking-tight">
            {t("mySolutions")}
          </h2>
          {assignment.mySolutions.length === 0 ? (
            <EmptyState
              title={t("noSolutions.title")}
              description={t("noSolutions.description")}
              headingLevel={3}
            />
          ) : (
            <SolutionList solutions={assignment.mySolutions} />
          )}
        </section>
      )}
    </div>
  );
}
