import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getExerciseLimitsData } from "@/lib/api/exercise-limits";
import { getExerciseDetail } from "@/lib/api/exercise-detail";
import { getRuntimeEnvironments } from "@/lib/api/runtime-environments";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { readLimits } from "@/lib/exercise-config/limits";

import { Link } from "@/i18n/navigation";
import { HardwareGroupsForm } from "@/components/exercises/config/hardware-groups-form";
import { LimitsForm } from "@/components/exercises/config/limits-form";
import { PageShell } from "@/components/page-shell";

/**
 * An exercise's resource limits (T-010) -- the legacy `/app/exercises/:id/edit-limits` route.
 *
 * Two questions, in order. **Which machines** the exercise is meant to run on, which is what
 * core-api's `@no-hwgroups` asks for and the last of the four reasons a freshly created exercise
 * calls itself broken; then **how much** each test may use on them, as a grid of test against
 * language, one grid per machine.
 *
 * The grid is not rendered without tests, without languages or without a hardware group, and says
 * which of the three is missing -- the same rule T-009's configuration form follows, and for the
 * same reason: the alternative is a grid of empty cells that explains nothing. Tests and languages
 * are T-009's to set, and this page links there rather than repeating them.
 *
 * Reading is `viewLimits`, writing is `setLimits`, and both are core-api's own hints -- separate
 * from the `update` that governs the rest of an exercise, which is why the read-only case here is
 * its own state rather than an inference from the settings screen's.
 */
export default async function EditExerciseLimitsPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const [{ exerciseId }, locale] = await Promise.all([params, getLocale()]);
  const [t, exercise] = await Promise.all([
    getTranslations("ExerciseLimits"),
    getExerciseDetail(exerciseId, locale),
  ]);

  if (exercise.can.viewLimits !== true) forbidden();

  const [data, environments, breadcrumbs] = await Promise.all([
    getExerciseLimitsData(exerciseId),
    getRuntimeEnvironments(),
    resolveBreadcrumbs(`/exercises/${exerciseId}/edit-limits`, locale),
  ]);

  const readOnly = exercise.can.setLimits !== true || exercise.archivedAt !== null;
  const environmentNames = new Map(environments.map((entry) => [entry.id, entry.name]));

  const tests = data.tests.map((test) => ({ id: String(test.id), name: test.name }));
  const columns = data.environmentIds.map((id) => ({ id, name: environmentNames.get(id) ?? id }));
  const ready = tests.length > 0 && columns.length > 0 && data.selected.length > 0;

  return (
    <PageShell
      title={t("title")}
      subtitle={exercise.name}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/exercises/${exerciseId}/edit-config`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("configure")}
          </Link>
          <Link
            href={`/exercises/${exerciseId}`}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("backToExercise")}
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-10">
        {exercise.archivedAt !== null && (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            {t("archivedNotice")}
          </p>
        )}
        {exercise.archivedAt === null && exercise.can.setLimits !== true && (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            {t("readOnlyNotice")}
          </p>
        )}

        <section aria-labelledby="limits-hardware" className="flex flex-col gap-3">
          <div>
            <h2 id="limits-hardware" className="text-base font-semibold tracking-tight">
              {t("hardwareGroups.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("hardwareGroups.explain")}</p>
          </div>
          <HardwareGroupsForm
            exerciseId={exerciseId}
            available={data.available}
            selected={data.selected.map((group) => group.id)}
            readOnly={exercise.can.update !== true || exercise.archivedAt !== null}
          />
        </section>

        <section aria-labelledby="limits-grid" className="flex flex-col gap-6">
          <div>
            <h2 id="limits-grid" className="text-base font-semibold tracking-tight">
              {t("form.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("form.explain")}</p>
          </div>

          {ready ? (
            data.selected.map((group) => (
              <section
                key={group.id}
                aria-label={group.name}
                className="flex flex-col gap-3 rounded-lg border border-border p-4"
              >
                <h3 className="text-sm font-semibold">{group.name}</h3>
                <LimitsForm
                  exerciseId={exerciseId}
                  hardwareGroup={group}
                  exerciseGroups={data.selected}
                  tests={tests}
                  environments={columns}
                  initial={readLimits(
                    data.limits,
                    group.id,
                    tests.map((test) => test.id),
                    columns.map((column) => column.id),
                  )}
                  readOnly={readOnly}
                />
              </section>
            ))
          ) : (
            <div className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
              <p>{t("form.unavailable")}</p>
              <ul className="mt-2 list-disc pl-5">
                {tests.length === 0 && <li>{t("form.noTests")}</li>}
                {columns.length === 0 && <li>{t("form.noEnvironments")}</li>}
                {data.selected.length === 0 && <li>{t("form.noHardwareGroups")}</li>}
              </ul>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
