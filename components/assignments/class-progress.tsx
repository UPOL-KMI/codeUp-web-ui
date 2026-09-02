import { getFormatter, getTranslations } from "next-intl/server";

import type { AssignmentSolver, AssignmentSolverSummary } from "@/lib/api/assignment-solvers";

import { EmptyState } from "@/components/state/empty-state";
import { SolverTable } from "@/components/assignments/solver-table";

/**
 * How the group is doing on one assignment (S-013, `docs/IA.md` §4.3's "assignment stats").
 *
 * Two numbers a teacher reads first -- how many have submitted, and how many got it right -- then
 * the roster itself. The average is over students whose best solution was **scored**, not over the
 * whole group: counting everyone who has not started as a zero turns "half the class hasn't begun"
 * into "the class is failing", which is a different claim.
 */
function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export async function ClassProgress({
  assignmentId,
  solvers,
  summary,
}: {
  assignmentId: string;
  solvers: AssignmentSolver[];
  summary: AssignmentSolverSummary;
}) {
  const [t, format] = await Promise.all([getTranslations("Assignment.solvers"), getFormatter()]);

  return (
    <section aria-labelledby="assignment-solvers-heading" className="flex flex-col gap-4">
      <h2 id="assignment-solvers-heading" className="text-base font-semibold tracking-tight">
        {t("heading")}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={t("stats.submitted")}
          value={`${summary.submitted}/${summary.students}`}
          note={t("stats.submittedNote")}
        />
        <Tile label={t("stats.correct")} value={String(summary.correct)} />
        <Tile
          label={t("stats.average")}
          value={
            summary.averagePoints === null
              ? "—"
              : `${format.number(summary.averagePoints, { maximumFractionDigits: 1 })}/${summary.maxPoints}`
          }
          note={summary.averagePoints === null ? t("stats.averageNone") : t("stats.averageNote")}
        />
        <Tile label={t("stats.reviewRequests")} value={String(summary.reviewRequests)} />
      </div>

      {solvers.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
          headingLevel={3}
        />
      ) : (
        <SolverTable solvers={solvers} assignmentId={assignmentId} />
      )}
    </section>
  );
}
