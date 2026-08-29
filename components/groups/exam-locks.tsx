import { getTranslations } from "next-intl/server";

import type { ExamLockRecord } from "@/lib/api/group-exams";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { EmptyState } from "@/components/state/empty-state";

/**
 * Who locked into one particular exam, when, and from where (S-008).
 *
 * The address column is present exactly when core-api sent an address: it strips `remoteAddr`
 * itself for a reader without `viewExamLocksIPs` (`GroupViewFactory::getGroupExamLocks`), so this
 * renders what arrived rather than re-deciding the permission -- the rule brief §3.4 states, and
 * one fewer place for the two answers to drift apart.
 */
export async function ExamLocks({ locks }: { locks: ExamLockRecord[] }) {
  const t = await getTranslations("Group.exams.locks");

  if (locks.length === 0) {
    return <EmptyState title={t("empty.title")} description={t("empty.description")} />;
  }

  const showAddress = locks.some((lock) => lock.remoteAddr !== null);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("columns.student")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("columns.lockedAt")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("columns.unlockedAt")}
            </th>
            {showAddress && (
              <th scope="col" className="px-3 py-2 font-medium">
                {t("columns.address")}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {locks.map((lock) => (
            <tr key={lock.id} className="border-t border-border">
              <td className="px-3 py-2">
                <Link
                  href={`/users/${lock.studentId}`}
                  className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {lock.studentName || lock.studentId}
                </Link>
              </td>
              <td className="px-3 py-2">
                <DateTime unixSeconds={lock.lockedAt} withSeconds />
              </td>
              <td className="px-3 py-2">
                {lock.unlockedAt ? (
                  <DateTime unixSeconds={lock.unlockedAt} withSeconds />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              {showAddress && (
                <td className="px-3 py-2">
                  <code className="text-xs">{lock.remoteAddr ?? "—"}</code>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
