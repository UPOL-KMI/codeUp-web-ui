/**
 * Mirrors `docs/SEED_ACCOUNTS.md` (F-025/F-026) -- kept as plain TS constants rather than parsed
 * out of that markdown table, since a hand-typed mismatch here would fail loudly (login 401) the
 * first time this file drifts from the seed script, rather than silently.
 */
export interface SeedAccount {
  readonly label: string;
  readonly email: string;
  readonly password: string;
}

export const SUPERADMIN: SeedAccount = {
  label: "superadmin",
  email: "admin@admin.com",
  password: "admin",
};

export const STUDENT: SeedAccount = {
  label: "student",
  email: "alice.student@seed.recodex.local",
  password: "RecodexSeed123!",
};

/**
 * The other seeded student in the primary group.
 *
 * Here because a flag that is unique per author is only safe to write on a student nothing else
 * reads: `reviewRequest` is one, and asking for a review as Alice withdrew the seed's own request
 * from her other attempt -- the row the teacher dashboard and the plagiarism report are found
 * through (PF-013).
 */
export const CLASSMATE: SeedAccount = {
  label: "classmate",
  email: "bob.classmate@seed.recodex.local",
  password: "RecodexSeed123!",
};

export const SUPERVISOR: SeedAccount = {
  label: "supervisor",
  email: "sam.supervisor@seed.recodex.local",
  password: "RecodexSeed123!",
};

export const SUPERVISOR_STUDENT: SeedAccount = {
  label: "supervisor-student",
  email: "sasha.mentor@seed.recodex.local",
  password: "RecodexSeed123!",
};

/**
 * One account per role, which is what the smoke sweep walks.
 *
 * `CLASSMATE` is deliberately **not** here: his role is the student's, so a second pass over every
 * route as him would assert what `STUDENT`'s pass already does. He exists for the specs that need
 * a *second* student rather than a different permission.
 */
export const SEED_ACCOUNTS: readonly SeedAccount[] = [
  SUPERADMIN,
  STUDENT,
  SUPERVISOR,
  SUPERVISOR_STUDENT,
];
