import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getMyGroups } from "@/lib/api/groups";
import { getRuntimeEnvironments } from "@/lib/api/runtime-environments";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { ImportClassroom } from "@/components/exercises/import-classroom";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ExerciseImport" });
  return { title: t("title") };
}

/**
 * Importing an exercise from a GitHub Classroom assignment (X-001).
 *
 * **Who may be here is decided by the same thing that decides who may create an exercise**, and
 * for the same reason: the exercise does not exist yet, so there is no ACL hint on it to ask.
 * core-api's condition is `group.isSupervisorOrAdmin` on a group that is not archived, which is
 * exactly the reader's own teaching groups -- and with none of them the screen says so rather than
 * offering a form whose first field has nothing in it. core-api decides again on every write.
 *
 * The languages offered are the ones this deployment actually installs, not a fixed list: an
 * environment the worker has no toolchain for would be accepted here and fail every submission.
 */
export default async function ImportExercisePage() {
  const locale = await getLocale();
  const [breadcrumbs, t, mine, environments] = await Promise.all([
    resolveBreadcrumbs("/exercises/import", locale),
    getTranslations("ExerciseImport"),
    getMyGroups(locale),
    getRuntimeEnvironments(),
  ]);

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")} breadcrumbs={breadcrumbs}>
      {mine.teaching.length === 0 ? (
        <EmptyState title={t("errors.noGroup")} description={t("intro")} />
      ) : (
        <ImportClassroom groups={mine.teaching} environments={environments} />
      )}
    </PageShell>
  );
}
