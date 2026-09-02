import { getTranslations } from "next-intl/server";

import type { ExamTerm } from "@/lib/api/group-detail";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { EmptyState } from "@/components/state/empty-state";

/**
 * The exams this group has already held (S-008).
 *
 * core-api records an exam **only from the moment a student first locks into it**
 * (`GroupsPresenter::actionLockStudent` creates the entity), so a period that was scheduled,
 * ran and ended with nobody locking in leaves no row here -- which is why the empty state says
 * "no exams recorded" rather than "no exams held".
 *
 * Selecting a row is a link, not a button: the selection is `?exam=` on this page's own URL, so a
 * teacher can send someone the lock records of one particular exam.
 */
export async function ExamTable({
  exams,
  groupId,
  selected,
  selectable,
}: {
  exams: ExamTerm[];
  groupId: string;
  selected: string | null;
  /** False for a reader who may not see lock records, and while an exam is running -- its records
   *  are not offered until it is over, as in the legacy page. A link to a section this page would
   *  not render is worse than no link. */
  selectable: boolean;
}) {
  const t = await getTranslations("Group.exams.table");
  const tExam = await getTranslations("Group.exams");

  if (exams.length === 0) {
    return (
      <EmptyState title={t("empty.title")} description={t("empty.description")} headingLevel={3} />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              #
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("columns.begin")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("columns.end")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("columns.lockType")}
            </th>
            {selectable && <th scope="col" className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {exams.map((exam, index) => {
            const isSelected = selected !== null && String(exam.id) === selected;
            return (
              <tr
                key={exam.id ?? index}
                className={`border-t border-border ${isSelected ? "bg-accent/40" : ""}`}
              >
                <td className="px-3 py-2 font-medium tabular-nums">{index + 1}</td>
                <td className="px-3 py-2">
                  <DateTime unixSeconds={exam.begin} withSeconds />
                </td>
                <td className="px-3 py-2">
                  <DateTime unixSeconds={exam.end} withSeconds />
                </td>
                <td className="px-3 py-2">
                  {exam.lockType ? tExam(`lockTypes.${exam.lockType}`) : t("unknownLockType")}
                </td>
                {selectable && (
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={
                        isSelected
                          ? `/groups/${groupId}?tab=exams`
                          : `/groups/${groupId}?tab=exams&exam=${exam.id}`
                      }
                      className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {isSelected ? t("unselect") : t("select")}
                    </Link>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
