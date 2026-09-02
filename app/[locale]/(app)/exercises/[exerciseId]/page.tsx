import { getLocale, getTranslations } from "next-intl/server";

import { getExerciseDetail } from "@/lib/api/exercise-detail";
import { formatBytes } from "@/lib/format/bytes";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { describeValidationError } from "@/lib/status/exercise-validation";

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
 * Nothing here writes. Editing is T-008's and the tests and their configuration are T-009's, and
 * both are linked from here now that those screens exist. The limits are T-010's, the assignments made from
 * it are T-012's and its reference solutions are T-011's; every one of them now exists and is
 * linked, which is what DEC-066's rule was waiting for.
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
          {exercise.can.update === true && (
            <Link
              href={`/exercises/${exerciseId}/edit`}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("edit")}
            </Link>
          )}
          {exercise.can.viewConfig === true && (
            <Link
              href={`/exercises/${exerciseId}/edit-config`}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("configure")}
            </Link>
          )}
          {exercise.can.viewLimits === true && (
            <Link
              href={`/exercises/${exerciseId}/edit-limits`}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("limits")}
            </Link>
          )}
          {exercise.can.viewAssignments === true && (
            <Link
              href={`/exercises/${exerciseId}/assignments`}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("assignmentsLink")}
            </Link>
          )}
          <Link
            href={`/exercises/${exerciseId}/reference-solutions`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("referenceSolutionsLink")}
          </Link>
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
                <li key={error}>{describeValidationError(error, t)}</li>
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
