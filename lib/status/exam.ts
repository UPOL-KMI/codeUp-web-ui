/**
 * An exam's lock type (S-008) -- how much of the rest of ReCodEx a student locked into the exam
 * may still reach. core-api's `GroupExamLockType`, in the order the legacy form offers them, from
 * the mildest to the one that cuts the most off.
 *
 * Its own module, not part of `lib/api/group-detail.ts`, because the exam *form* needs these
 * values and that module is `server-only`: a shared schema is imported by the client too
 * (D-004's rule, learned the hard way there).
 */
export const EXAM_LOCK_TYPES = ["visible", "reviewed", "accepted", "restricted"] as const;

export type ExamLockType = (typeof EXAM_LOCK_TYPES)[number];

/** core-api's own value, or null for a group with no exam -- never a guess. */
export function parseExamLockType(value: string | null | undefined): ExamLockType | null {
  return EXAM_LOCK_TYPES.find((candidate) => candidate === value) ?? null;
}

/**
 * Where an exam period stands relative to a moment: not set (or already over), coming, or running.
 *
 * A pure function of the clock it is handed, so both sides can use it and neither has to guess
 * what the other decided -- the page passes the server's clock to choose what to fetch, and the
 * status island passes the browser's, ticking, to notice when the two have diverged (S-008).
 */
export type ExamPhase = "none" | "scheduled" | "running";

export function phaseAt(now: number, begin: number | null, end: number | null): ExamPhase {
  if (!begin || !end || end <= now) return "none";
  return begin <= now ? "running" : "scheduled";
}

/** `phaseAt` against the caller's own clock -- kept out of components, which may not read it. */
export function currentPhase(begin: number | null, end: number | null): ExamPhase {
  return phaseAt(Math.floor(Date.now() / 1000), begin, end);
}
