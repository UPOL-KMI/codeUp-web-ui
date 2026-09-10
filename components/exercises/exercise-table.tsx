import { getTranslations } from "next-intl/server";

import type { ExerciseCatalogPage } from "@/lib/api/exercises";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { Badge } from "@/components/status/badge";

/**
 * The catalog itself (T-020): one row per exercise, ordered by name.
 *
 * Not a `DataTable`, for the reason the points matrix is not one either but the other way round:
 * this list is **not fetched whole**. Sorting, filtering and paging all happen in core-api, so a
 * control that reordered the twenty rows on screen would be lying about the other nine hundred.
 * Everything that narrows the list is in the URL and goes back to the server.
 *
 * The badges are the states a teacher has to see before clicking: an exercise nobody can assign
 * because it will not compile, one that is deliberately locked, one still without a reference
 * solution -- which is the fifth condition on assigning and, contrary to DEC-093, visible here.
 */
export async function ExerciseTable({ page }: { page: ExerciseCatalogPage }) {
  const t = await getTranslations("Exercises");
  // core-api serves an empty difficulty for an exercise nobody set one on, and next-intl answers a
  // missing key with the key path -- so the catalog used to show readers `difficulty.` and log a
  // `MISSING_MESSAGE` per row (G-031b).
  const difficulty = (value: string) =>
    t.has(`difficulty.${value}`) ? t(`difficulty.${value}`) : t("difficulty.unset");

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {t("columns.name")}
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {t("columns.difficulty")}
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {t("columns.environments")}
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {t("columns.tags")}
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {t("columns.author")}
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {t("columns.updated")}
            </th>
          </tr>
        </thead>
        <tbody>
          {page.items.map((exercise) => (
            <tr
              key={exercise.id}
              className="border-b border-border last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <span className="flex flex-col gap-1">
                  {exercise.can.viewDetail ? (
                    <Link
                      href={`/exercises/${exercise.id}`}
                      className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {exercise.name || t("untitled")}
                    </Link>
                  ) : (
                    <span className="font-medium">{exercise.name || t("untitled")}</span>
                  )}
                  <span className="flex flex-wrap gap-1">
                    {exercise.archived && <Badge tone="neutral">{t("flags.archived")}</Badge>}
                    {!exercise.isPublic && <Badge tone="neutral">{t("flags.private")}</Badge>}
                    {exercise.isLocked && <Badge tone="warning">{t("flags.locked")}</Badge>}
                    {exercise.isBroken && <Badge tone="danger">{t("flags.broken")}</Badge>}
                    {!exercise.hasReferenceSolutions && (
                      <Badge tone="warning">{t("flags.noReferenceSolution")}</Badge>
                    )}
                  </span>
                </span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{difficulty(exercise.difficulty)}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {exercise.environments.join(", ") || "—"}
              </td>
              <td className="px-3 py-2">
                <span className="flex flex-wrap gap-1">
                  {exercise.tags.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    exercise.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)
                  )}
                </span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {page.authors.get(exercise.authorId) ? (
                  <Link
                    href={`/users/${exercise.authorId}`}
                    className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {page.authors.get(exercise.authorId)}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                <DateTime unixSeconds={exercise.updatedAt} dateOnly />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
