import { getLocale, getTranslations } from "next-intl/server";

import { getExerciseDetail } from "@/lib/api/exercise-detail";
import { formatBytes } from "@/lib/format/bytes";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { ExerciseDetailPanel } from "@/components/exercises/exercise-detail";
import { Markdown } from "@/components/markdown/markdown";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/status/badge";

/**
 * One exercise, read (T-021) -- the legacy `/app/exercises/:exerciseId` route, and where the
 * catalog's rows lead.
 *
 * The screen answers "should I assign this", in this order: what state it is in (the callouts),
 * what it asks a student to do (the text), and what it is made of (the panel). **When core-api
 * says an exercise is broken it also says why**, and those reasons are the most useful thing on
 * the page -- `@no-tests`, `@no-runtimes` and the rest are each a specific missing piece, which
 * this app states in words rather than showing a red badge and leaving the reader to guess.
 *
 * Nothing here writes. Editing is T-008's, the tests are T-009's, the limits T-010's, the
 * reference solutions T-011's and the assignments made from this exercise T-012's; none of those
 * screens exists yet, so this page names what it knows and links to none of them (DEC-066).
 */
export default async function ExercisePage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const [{ exerciseId }, locale] = await Promise.all([params, getLocale()]);
  const [t, exercise] = await Promise.all([
    getTranslations("Exercise"),
    getExerciseDetail(exerciseId, locale),
  ]);
  const breadcrumbs = await resolveBreadcrumbs(`/exercises/${exerciseId}`, locale);

  const otherLocales = exercise.texts
    .map((text) => text.locale)
    .filter((candidate) => candidate !== exercise.text?.locale);

  return (
    <PageShell
      title={exercise.name || t("untitled")}
      subtitle={exercise.text?.description || undefined}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {exercise.archivedAt !== null && <Badge tone="neutral">{t("flags.archived")}</Badge>}
          {!exercise.isPublic && <Badge tone="neutral">{t("flags.private")}</Badge>}
          {exercise.isLocked && <Badge tone="warning">{t("flags.locked")}</Badge>}
          {exercise.isBroken && <Badge tone="danger">{t("flags.broken")}</Badge>}
          <Link
            href="/exercises"
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("backToCatalog")}
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        {exercise.isBroken && (
          <section
            aria-labelledby="exercise-broken"
            className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm"
          >
            <h2 id="exercise-broken" className="font-medium">
              {t("broken.title")}
            </h2>
            <p className="mt-1 text-muted-foreground">{t("broken.explain")}</p>
            <ul className="mt-2 list-disc pl-5">
              {exercise.validationErrors.map((error) => (
                <li key={error}>{describe(error, t)}</li>
              ))}
            </ul>
          </section>
        )}

        {!exercise.isBroken && !exercise.hasReferenceSolutions && (
          <p className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
            {t("noReferenceSolution")}
          </p>
        )}

        {exercise.archivedAt !== null && (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            {t("archived.explain")}
          </p>
        )}

        <section aria-labelledby="exercise-text" className="flex flex-col gap-3">
          <h2 id="exercise-text" className="text-base font-semibold tracking-tight">
            {t("text")}
          </h2>
          {exercise.text && exercise.text.text.trim() !== "" ? (
            <div className="rounded-lg border border-border p-4">
              <Markdown source={exercise.text.text} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noText")}</p>
          )}
          {otherLocales.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("otherLocales", { locales: otherLocales.join(", ") })}
            </p>
          )}
          {exercise.text?.link && (
            <p className="text-xs text-muted-foreground">
              <a
                href={exercise.text.link}
                rel="noreferrer noopener"
                className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t("externalText")}
              </a>
            </p>
          )}
        </section>

        <section aria-labelledby="exercise-details" className="flex flex-col gap-3">
          <h2 id="exercise-details" className="text-base font-semibold tracking-tight">
            {t("details")}
          </h2>
          <ExerciseDetailPanel exercise={exercise} />
        </section>

        <section aria-labelledby="exercise-files" className="flex flex-col gap-3">
          <h2 id="exercise-files" className="text-base font-semibold tracking-tight">
            {t("files")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("filesExplain")}</p>
          {exercise.files.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noFiles")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {exercise.files.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="font-mono text-xs">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}

/**
 * core-api's validation failures arrive as `@key some English sentence`. The keys are a closed set
 * the legacy app translates one by one; this does the same, and falls back to core-api's own words
 * for a key nobody has a sentence for yet -- which is better than dropping a reason.
 */
function describe(error: string, t: (key: string) => string): string {
  const match = /^@([\w-]+)\s*(.*)$/s.exec(error);
  if (!match) return error;
  const [, key, rest] = match;
  const known = [
    "no-texts",
    "no-tests",
    "score",
    "no-runtimes",
    "runtimes",
    "no-configs",
    "no-hwgroups",
    "config",
    "limits",
  ];
  return known.includes(key!) ? t(`validation.${key}`) : (rest ?? error);
}
