import "server-only";

import { apiPost } from "./client";
import { apiRead, pageRead } from "./read";

/**
 * The people side of an exam (S-008): who is locked in while it runs, and who locked in during one
 * that has ended.
 *
 * The exam **term** itself -- begin, end, lock type, and the list of previous exams -- is not here.
 * It arrives on the group's own response (`privateData.examBegin`/`examEnd`/`examLockType`/`exams`)
 * and is read by `getGroupDetail`, so the tab costs one request for the group rather than two for
 * the same bytes.
 */
export interface ExamStudent {
  id: string;
  fullName: string;
  /** Locked into *this* group. core-api reports the lock without its expiry for anyone but its owner. */
  locked: boolean;
  /** The address the lock was taken from; null when this reader may not see addresses. */
  ipLock: string | null;
  lastAuthenticationAt: number | null;
}

interface UserPayload {
  id: string;
  fullName: string;
  privateData?: {
    ipLock?: string | null;
    groupLock?: string | null;
    lastAuthenticationAt?: number | null;
  };
}

/**
 * The group's students, each with whether they are locked into this exam.
 *
 * **Locked means `groupLock` names this group, and nothing more.** core-api discloses
 * `groupLockExpiration` only to the lock's own owner (`UserViewFactory`), so a teacher's copy of a
 * student cannot say whether the lock has expired -- the legacy app has the same blind spot and
 * resolves it the same way. It is accurate while an exam runs, which is the only time this list is
 * shown; an expired lock from a finished exam would otherwise still read as locked.
 */
export async function getExamRoster(studentIds: string[], groupId: string): Promise<ExamStudent[]> {
  if (studentIds.length === 0) return [];

  const people = await pageRead(apiPost<UserPayload[]>("/v1/users/list", { ids: studentIds }));

  return people
    .map((person) => ({
      id: person.id,
      fullName: person.fullName,
      locked: person.privateData?.groupLock === groupId,
      ipLock: person.privateData?.ipLock ?? null,
      lastAuthenticationAt: person.privateData?.lastAuthenticationAt ?? null,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export interface ExamLockRecord {
  id: number;
  studentId: string;
  studentName: string;
  lockedAt: number;
  unlockedAt: number | null;
  /** Stripped by core-api itself unless the reader holds `viewExamLocksIPs` -- not gated here. */
  remoteAddr: string | null;
}

interface LockPayload {
  id: number;
  studentId: string;
  createdAt: number;
  unlockedAt?: number | null;
  remoteAddr?: string | null;
}

/**
 * The locking events recorded for one finished exam.
 *
 * A `GroupExam` record exists only from the moment a student first locks in -- core-api creates it
 * in `actionLockStudent`, not when the period is set -- so an exam nobody attended leaves no trace
 * to ask about, and the previous-exams table lists exactly those that someone locked into.
 */
export async function getExamLocks(groupId: string, examId: string): Promise<ExamLockRecord[]> {
  const locks = await apiRead<LockPayload[]>("/v1/groups/{id}/exam/{examId}", {
    pathParams: { id: groupId, examId },
  });
  if (locks.length === 0) return [];

  const ids = [...new Set(locks.map((lock) => lock.studentId))];
  const people = await pageRead(apiPost<UserPayload[]>("/v1/users/list", { ids }));
  const names = new Map(people.map((person) => [person.id, person.fullName]));

  return locks
    .map((lock) => ({
      id: lock.id,
      studentId: lock.studentId,
      studentName: names.get(lock.studentId) ?? "",
      lockedAt: lock.createdAt,
      unlockedAt: lock.unlockedAt ?? null,
      remoteAddr: lock.remoteAddr ?? null,
    }))
    .sort((a, b) => a.lockedAt - b.lockedAt);
}
