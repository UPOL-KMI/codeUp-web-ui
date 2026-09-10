import { getTranslations } from "next-intl/server";

import type { ExerciseDetail } from "@/lib/api/exercise-detail";
import { formatBytes } from "@/lib/format/bytes";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { Badge } from "@/components/status/badge";

/**
 * What an exercise is, for somebody deciding whether to assign it (T-021).
 *
 * The rows are the ones the legacy detail panel carries, minus the ones that belong to screens
 * this app has not built: tests and limits are T-009's and T-010's, and repeating a fragment of
 * them here would be a second, drifting answer.
 *
 * **The short description is a supervisors' field**, not part of the exercise text a student ever
 * sees -- core-api keeps it in the same `localizedTexts` record and the legacy panel labels it as
 * such, which is worth keeping: it is where an author writes "this one is harder than it looks".
 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-4 border-b border-border py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm">{children}</dd>
    </div>
  );
}

export async function ExerciseDetailPanel({ exercise }: { exercise: ExerciseDetail }) {
  const t = await getTranslations("Exercise");

  return (
    <dl className="grid gap-x-8 sm:grid-cols-2">
      <Row label={t("author")}>
        <Link
          href={`/users/${exercise.author.id}`}
          className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {exercise.author.name || exercise.author.id}
        </Link>
      </Row>

      {exercise.admins.length > 0 && (
        <Row label={t("admins")}>
          <span className="flex flex-col gap-0.5">
            {exercise.admins.map((admin) => (
              <Link
                key={admin.id}
                href={`/users/${admin.id}`}
                className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {admin.name || admin.id}
              </Link>
            ))}
          </span>
        </Row>
      )}

      <Row label={t("difficulty")}>
        {t.has(`difficulties.${exercise.difficulty}`)
          ? t(`difficulties.${exercise.difficulty}`)
          : t("difficulties.unset")}
      </Row>

      <Row label={t("environments")}>
        {exercise.environments.length === 0 ? (
          <span className="text-muted-foreground">{t("noEnvironments")}</span>
        ) : (
          exercise.environments.map((environment) => environment.name).join(", ")
        )}
      </Row>

      <Row label={t("tags")}>
        {exercise.tags.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-wrap justify-end gap-1">
            {exercise.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </span>
        )}
      </Row>

      <Row label={t("groups")}>
        {exercise.groups.length === 0 && exercise.undisclosedGroups === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-col gap-0.5">
            {exercise.groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {group.name}
              </Link>
            ))}
            {/* Named rather than hidden: an exercise can belong to a group this reader cannot
                see, and "three groups, one of which is not yours" is the honest answer. */}
            {exercise.undisclosedGroups > 0 && (
              <span className="text-muted-foreground">
                {t("undisclosedGroups", { count: exercise.undisclosedGroups })}
              </span>
            )}
          </span>
        )}
      </Row>

      <Row label={t("visibility")}>{exercise.isPublic ? t("public") : t("private")}</Row>

      <Row label={t("assignments")}>
        {t("assignmentCount", { count: exercise.assignmentCount })}
      </Row>

      <Row label={t("solutionLimits")}>
        {t("solutionLimitsValue", {
          files: exercise.solutionFilesLimit ?? 0,
          size: formatBytes(exercise.solutionSizeLimit ?? 0),
        })}
      </Row>

      <Row label={t("created")}>
        <DateTime unixSeconds={exercise.createdAt} dateOnly />
      </Row>

      <Row label={t("updated")}>
        <span className="flex flex-wrap items-center justify-end gap-2">
          <DateTime unixSeconds={exercise.updatedAt} dateOnly />
          <span className="text-muted-foreground">
            {t("version", { version: exercise.version })}
          </span>
        </span>
      </Row>

      {exercise.forkedFrom !== null && (
        <Row label={t("forkedFrom")}>
          <Link
            href={`/exercises/${exercise.forkedFrom}`}
            className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("theOriginal")}
          </Link>
        </Row>
      )}
    </dl>
  );
}
