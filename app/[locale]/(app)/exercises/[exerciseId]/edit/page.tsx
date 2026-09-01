import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getExerciseDetail } from "@/lib/api/exercise-detail";
import { getMyGroups } from "@/lib/api/groups";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { routing } from "@/i18n/routing";

import { Link } from "@/i18n/navigation";
import { ExerciseControls } from "@/components/exercises/exercise-controls";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { PageShell } from "@/components/page-shell";

/**
 * An exercise's basic settings (T-008) -- the legacy `/app/exercises/:id/edit` route, and where
 * creating one lands.
 *
 * **The page asks `update` itself rather than relying on `apiRead`'s 403.** Reading an exercise is
 * something any teacher may do, so the fetch succeeds for someone who may not change it and only
 * the save would be refused -- the same trap T-002 fell into and DEC-092 records. Being handed a
 * filled-in form for something you may not touch is its own defect.
 *
 * An **archived** exercise is frozen: core-api refuses to update it, so the form is not rendered
 * for one at all rather than rendered and refused on submit (S-009's rule for an archived group).
 * Unarchiving is still offered, and is the way back.
 *
 * What is **not** here, and is recorded as T-023 rather than dropped: the exercise's own files and
 * their links, its administrators, and forking it into another group. The tests (T-009), the
 * limits (T-010) and the reference solutions (T-011) are their own screens by the backlog's own
 * plan.
 */
export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const [{ exerciseId }, locale] = await Promise.all([params, getLocale()]);
  const [t, exercise] = await Promise.all([
    getTranslations("ExerciseEdit"),
    getExerciseDetail(exerciseId, locale),
  ]);

  // Any one of the three things this screen can do -- S-009's rule for the group settings tab, and
  // for the same reason it was needed there: **archiving an exercise takes `update` away**
  // (core-api's rule carries `exercise.notArchived`), so gating the page on `update` alone would
  // lock the reader out of the screen holding the button that undoes it. Found by this ticket's
  // own spec, which archived an exercise and was then refused the page.
  if (
    exercise.can.update !== true &&
    exercise.can.archive !== true &&
    exercise.can.remove !== true
  ) {
    forbidden();
  }

  const [mine, breadcrumbs] = await Promise.all([
    getMyGroups(locale),
    resolveBreadcrumbs(`/exercises/${exerciseId}/edit`, locale),
  ]);

  return (
    <PageShell
      title={t("title")}
      subtitle={exercise.name}
      breadcrumbs={breadcrumbs}
      actions={
        <Link
          href={`/exercises/${exerciseId}`}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("backToExercise")}
        </Link>
      }
    >
      <div className="flex flex-col gap-10">
        {exercise.archivedAt !== null || exercise.can.update !== true ? (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            {exercise.archivedAt !== null ? t("archivedNotice") : t("readOnlyNotice")}
          </p>
        ) : (
          <section aria-labelledby="exercise-settings" className="flex flex-col gap-3">
            <h2 id="exercise-settings" className="text-base font-semibold tracking-tight">
              {t("settings")}
            </h2>
            <ExerciseForm exercise={exercise} locales={routing.locales} />
          </section>
        )}

        <ExerciseControls exercise={exercise} teachingGroups={mine.teaching} />
      </div>
    </PageShell>
  );
}
