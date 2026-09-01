import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getAssignableExercises } from "@/lib/api/exercises";
import { getGroupDetail } from "@/lib/api/group-detail";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { ExercisePicker } from "@/components/assignments/exercise-picker";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";

/**
 * Assigning an exercise to a group (T-001) -- the step before T-002's settings, and the only way
 * an assignment comes into existence.
 *
 * **The search is a server round trip, not `DataTable`'s client-side filter.** The catalog is the
 * one list in this app that genuinely is not fetched whole: `/v1/exercises` is paginated and an
 * instance can hold thousands, so the query goes to core-api (which accepts `search`) and the
 * result says how many matched in total. That is the opposite trade from S-004's group list, and
 * deliberately: the difference is whether "everything" is a number you can hold.
 *
 * Gated on the **group's** `assignExercise`, checked here: the group's own detail is a permitted
 * read for its students, so `apiRead`'s 403 would never fire -- the same trap T-002 fell into and
 * DEC-092 records. Each row is then gated again on the exercise's own `assign`.
 */
export default async function AssignExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ groupId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const [t, group] = await Promise.all([
    getTranslations("AssignExercise"),
    getGroupDetail(groupId, locale),
  ]);

  if (group.can.assignExercise !== true || group.organizational) forbidden();

  const search = (query.q ?? "").trim();
  const [{ exercises, totalCount }, breadcrumbs] = await Promise.all([
    getAssignableExercises(locale, search),
    resolveBreadcrumbs(`/groups/${groupId}/assign`, locale),
  ]);

  return (
    <PageShell
      title={t("title")}
      subtitle={group.name}
      breadcrumbs={breadcrumbs}
      actions={
        <Link
          href={`/groups/${groupId}?tab=assignments`}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("backToGroup")}
        </Link>
      }
    >
      <div className="flex max-w-3xl flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("explain")}</p>

        <form method="get" className="flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={search}
            aria-label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("search")}
          </button>
        </form>

        {exercises.length === 0 ? (
          <EmptyState
            title={t("empty.title")}
            description={search === "" ? t("empty.description") : t("empty.noMatch")}
            headingLevel={3}
          />
        ) : (
          <>
            <ExercisePicker exercises={exercises} groupId={groupId} />
            {totalCount > exercises.length && (
              <p className="text-xs text-muted-foreground">
                {t("more", { shown: exercises.length, total: totalCount })}
              </p>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
