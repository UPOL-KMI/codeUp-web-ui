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

export const SEED_ACCOUNTS: readonly SeedAccount[] = [
  SUPERADMIN,
  STUDENT,
  SUPERVISOR,
  SUPERVISOR_STUDENT,
];
