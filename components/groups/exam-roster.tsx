"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { unlockStudentFromExam } from "@/lib/actions/group-exam";
import type { ExamStudent } from "@/lib/api/group-exams";
import { DATE_TIME_FORMAT } from "@/lib/format/date-time";

import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * Who is in the room, while the exam is running (S-008): the students who have locked in, and the
 * ones who have not yet -- side by side, because the second list is the one a supervisor watches.
 *
 * A student's last sign-in is shown beside the ones who have not locked in, exactly as the legacy
 * table does: it is what distinguishes "sitting there, has not pressed the button" from "not here
 * at all".
 *
 * Unlocking is offered per row and is not confirmed twice: it is reversible (the student can lock
 * in again from wherever they now are), and a supervisor doing it is answering a question someone
 * asked them out loud.
 */
export function ExamRoster({ groupId, students }: { groupId: string; students: ExamStudent[] }) {
  const t = useTranslations("Group.exams.roster");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const locked = students.filter((student) => student.locked);
  const waiting = students.filter((student) => !student.locked);

  async function unlock(student: ExamStudent) {
    setPendingId(student.id);
    const result = await unlockStudentFromExam(groupId, student.id);
    setPendingId(null);
    if (result.success) {
      toast.success(t("toast.unlocked", { name: student.fullName }));
      router.refresh();
    } else {
      toast.error(t("errors.unlockFailed"), result.formError);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">
          {t("locked.title")}{" "}
          <span className="text-muted-foreground tabular-nums">({locked.length})</span>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          {locked.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("locked.empty")}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {locked.map((student) => (
                  <tr key={student.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 font-medium">{student.fullName || student.id}</td>
                    <td className="px-3 py-2">
                      {student.ipLock && <code className="text-xs">{student.ipLock}</code>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={pendingId === student.id}
                        onClick={() => void unlock(student)}
                        className={buttonClasses("outline", "xs")}
                      >
                        {t("locked.unlock")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">
          {t("waiting.title")}{" "}
          <span className="text-muted-foreground tabular-nums">({waiting.length})</span>
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          {waiting.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("waiting.empty")}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {waiting.map((student) => (
                  <tr key={student.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 font-medium">{student.fullName || student.id}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {student.lastAuthenticationAt
                        ? t("waiting.lastSeen", {
                            when: format.dateTime(
                              new Date(student.lastAuthenticationAt * 1000),
                              DATE_TIME_FORMAT,
                            ),
                          })
                        : t("waiting.neverSeen")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
