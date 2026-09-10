import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getAssignmentSolutions } from "@/lib/api/assignment-solutions";
import {
  canDisplayFiles,
  getFileContent,
  getSolutionFiles,
  type SolutionFileEntry,
} from "@/lib/api/solution-files";
import { getSolutionDetail } from "@/lib/api/solution";
import {
  applyManualPairs,
  encodeFilePair,
  pairFilesByName,
  parseFilePairs,
} from "@/lib/code/diff";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";
import { DiffView } from "@/components/solutions/diff-view";
import { EmptyState } from "@/components/state/empty-state";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Diff" });
  return { title: t("title") };
}

/**
 * Two solutions, file by file (G-005) -- the brief §7 landmine this rewrite stepped on. The legacy
 * app ships `react-diff-viewer` for it; `INVENTORY.md` named the capability in three rows with
 * "keep capability" beside it, and nothing was built until now.
 *
 * **The route carries both solutions, so a comparison is a link.** That is the legacy URL's own
 * shape (`/diff/:secondSolutionId`) and it is what makes "look at these two" something a teacher
 * can send to a colleague. Swapping sides is the same route with the ids the other way round.
 *
 * **Reviews are deliberately absent**, as they are in the legacy diff. A review is written against
 * one solution's lines; interleaved into an aligned two-file view its anchors would point at rows
 * that may belong to the other file, and a comment shown against the wrong line is worse than one
 * not shown at all. The sources screen is where a review is read.
 */
export default async function SolutionDiffPage({
  params,
  searchParams,
}: {
  params: Promise<{ solutionId: string; otherId: string }>;
  searchParams: Promise<{ pair?: string | string[] }>;
}) {
  const [{ solutionId, otherId }, query, locale] = await Promise.all([
    params,
    searchParams,
    getLocale(),
  ]);
  const [t, left, right] = await Promise.all([
    getTranslations("Diff"),
    getSolutionDetail(solutionId, locale),
    getSolutionDetail(otherId, locale),
  ]);

  // Comparing is a teacher's tool, and the hint that says so is the **assignment's**
  // `viewAssignmentSolutions` -- who may read other people's attempts. The solution's own
  // `viewDetail` is not it: an author has that for their own work, and gating on it would both
  // offer a student this screen and send them into an endpoint core-api refuses them. Checked on
  // *both* solutions, because the two may belong to different assignments.
  if (!left.canViewSolutions || !right.canViewSolutions) forbidden();

  const [leftFiles, rightFiles, breadcrumbs, siblings] = await Promise.all([
    getSolutionFiles(solutionId),
    getSolutionFiles(otherId),
    resolveBreadcrumbs(`/solutions/${solutionId}/sources`, locale),
    getAssignmentSolutions(left.assignmentId),
  ]);

  const tooBig = !canDisplayFiles(leftFiles) || !canDisplayFiles(rightFiles);
  // G-030. The reader's own pairings ride in `searchParams`, applied on top of the name-based
  // ones -- so a comparison of two differently-named files is a link like any other view of this
  // screen. `applyManualPairs` checks each one against what is actually unpaired, so a stale link
  // cannot fabricate a pair.
  const manual = parseFilePairs(query.pair);
  const { pairs, onlyLeft, onlyRight } = applyManualPairs(
    pairFilesByName(leftFiles, rightFiles),
    manual,
  );
  const applied = manual.filter(
    ([left, right]) =>
      pairs.some((pair) => pair.left.name === left && pair.right.name === right),
  );

  const contents = tooBig
    ? []
    : await Promise.all(
        pairs.map(async (pair) => ({
          name: pair.left.name,
          left: await readOrEmpty(pair.left),
          right: await readOrEmpty(pair.right),
        })),
      );

  const label = (attempt: number, name: string) => t("attemptOf", { attempt, name });
  const leftLabel = label(left.attemptIndex, left.assignmentName);
  const rightLabel = label(right.attemptIndex, right.assignmentName);
  const others = siblings.filter(
    (row) => row.id !== solutionId && row.id !== otherId && row.authorId === left.authorId,
  );

  return (
    <PageShell
      title={t("title")}
      subtitle={t("subtitle", { left: leftLabel, right: rightLabel })}
      breadcrumbs={[...breadcrumbs.slice(0, -1), { label: t("title") }]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/solutions/${otherId}/diff/${solutionId}`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("swap")}
          </Link>
          <Link
            href={`/solutions/${solutionId}/sources`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("backToSources")}
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        <p className="text-sm text-muted-foreground">
          {t("explain", { left: leftLabel, right: rightLabel })}
        </p>

        {tooBig ? (
          <EmptyState title={t("tooBig.title")} description={t("tooBig.description")} />
        ) : pairs.length === 0 ? (
          <EmptyState title={t("noPairs.title")} description={t("noPairs.description")} />
        ) : (
          contents.map((file) => (
            <DiffView
              key={file.name}
              name={file.name}
              leftContent={file.left}
              rightContent={file.right}
              leftLabel={leftLabel}
              rightLabel={rightLabel}
            />
          ))
        )}

        {(onlyLeft.length > 0 || onlyRight.length > 0) && (
          <section aria-labelledby="diff-unpaired" className="flex flex-col gap-2">
            <h2 id="diff-unpaired" className="text-base font-semibold tracking-tight">
              {t("unpaired.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("unpaired.explain")}</p>
            <ul className="flex flex-col gap-2 text-sm">
              {onlyLeft.map((file) => (
                <li key={`l-${file.name}`} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">
                    {t("unpaired.onlyIn", { name: file.name, side: leftLabel })}
                  </span>
                  {/* G-030. A plain GET form: submitting lands on this same screen with one more
                      `pair`, so it needs no JavaScript and the result is a shareable link. The
                      pairings already applied travel as hidden fields, because a GET form
                      replaces the whole query string rather than adding to it. */}
                  {onlyRight.length > 0 && (
                    <form method="get" className="flex flex-wrap items-center gap-1">
                      {applied.map(([left, right]) => (
                        <input
                          key={`${left}:${right}`}
                          type="hidden"
                          name="pair"
                          value={encodeFilePair(left, right)}
                        />
                      ))}
                      <label className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">
                          {t("unpaired.compareWith")}
                        </span>
                        <select
                          name="pair"
                          defaultValue=""
                          aria-label={t("unpaired.compareWithLabel", { name: file.name })}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">{t("unpaired.choose")}</option>
                          {onlyRight.map((candidate) => (
                            <option
                              key={candidate.name}
                              value={encodeFilePair(file.name, candidate.name)}
                            >
                              {candidate.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="submit"
                        className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {t("unpaired.compare")}
                      </button>
                    </form>
                  )}
                </li>
              ))}
              {onlyRight.map((file) => (
                <li key={`r-${file.name}`} className="font-mono">
                  {t("unpaired.onlyIn", { name: file.name, side: rightLabel })}
                </li>
              ))}
            </ul>
          </section>
        )}

        {others.length > 0 && (
          <section aria-labelledby="diff-others" className="flex flex-col gap-2">
            <h2 id="diff-others" className="text-base font-semibold tracking-tight">
              {t("others.title")}
            </h2>
            <ul className="flex flex-col gap-1 text-sm">
              {others.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/solutions/${solutionId}/diff/${row.id}`}
                    className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {t("otherAttempt", { attempt: row.attemptIndex })}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  );
}

/** A file this app cannot read is compared as empty rather than failing the whole page (F-030). */
async function readOrEmpty(file: SolutionFileEntry): Promise<string> {
  try {
    const content = await getFileContent(file.fileId, file.entry);
    return content.malformedCharacters ? "" : content.content;
  } catch {
    return "";
  }
}
