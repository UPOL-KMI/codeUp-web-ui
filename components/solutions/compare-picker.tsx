import { getTranslations } from "next-intl/server";

import { getAssignmentSolutions } from "@/lib/api/assignment-solutions";

import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/button";

/**
 * The way into a comparison (G-005): the author's other attempts at this assignment.
 *
 * **Their other attempts, not everybody's.** Comparing two students' submissions is what S-019's
 * plagiarism report is for, and it says so with a similarity score and a detection batch behind it;
 * an unlabelled two-column diff of two people's work invites the same conclusion with none of the
 * evidence. What a teacher wants here is how *this* student's work changed between attempts.
 *
 * A server component, so the list costs no client JavaScript -- it is a handful of links, and the
 * solutions of the assignment are already fetched on the screens that lead here.
 */
export async function ComparePicker({
  solutionId,
  assignmentId,
  authorId,
}: {
  solutionId: string;
  assignmentId: string;
  authorId: string;
}) {
  const [t, solutions] = await Promise.all([
    getTranslations("Diff.picker"),
    getAssignmentSolutions(assignmentId),
  ]);

  const others = solutions.filter((row) => row.authorId === authorId && row.id !== solutionId);
  if (others.length === 0) return null;

  return (
    <section aria-labelledby="compare-with" className="flex flex-col gap-2">
      <h2 id="compare-with" className="text-base font-semibold tracking-tight">
        {t("title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("explain")}</p>
      <ul className="flex flex-wrap gap-2">
        {others.map((row) => (
          <li key={row.id}>
            <Link
              href={`/solutions/${solutionId}/diff/${row.id}`}
              className={buttonClasses("outline", "sm")}
            >
              {t("attempt", { attempt: row.attemptIndex })}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
