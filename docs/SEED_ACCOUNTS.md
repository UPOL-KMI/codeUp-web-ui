# ReCodEx New Frontend — Seed Test Accounts

**Status:** Pending creation by `scripts/seed.ts`
**Date:** 2026-05-11

---

## Accounts to Create

| Username | Password | Global Role | Group Memberships | Purpose |
|---|---|---|---|---|
| `[seed]student1` | `seed-student1` | `student` | Student of Group A | Pure student view, deadlines, submissions |
| `[seed]student2` | `seed-student2` | `student` | Student of Group A, Student of Group B | Student in multiple groups |
| `[seed]supervisor1` | `seed-supervisor1` | `supervisor` | Admin of Group A, Member of Group B | Teacher view, review workflows, admin of one group |
| `[seed]supervisor2` | `seed-supervisor2` | `supervisor` | Admin of Group B, Member of Group C | Teacher in multiple groups |
| `[seed]sup-student1` | `seed-sup-student1` | `supervisor-student` | Supervisor of Group A, Student of Group B | §2 "one person, two audiences" case |
| `admin@admin.com` | *(existing)* | `superadmin` | — | Superadmin, user takeover, instance admin |

---

## Groups to Create

| Name | Description | Parent | Status |
|---|---|---|---|
| `[seed]Group A` | Main test group | — | Active |
| `[seed]Group A1` | Subgroup of A | Group A | Active |
| `[seed]Group A2` | Another subgroup of A | Group A | Active |
| `[seed]Group B` | Second test group | — | Active |
| `[seed]Group C` | Third test group | — | Active |
| `[seed]Group D` | Archived group | — | Archived |

---

## Assignments to Create

| Exercise | Group | Deadline | Points | Notes |
|---|---|---|---|---|
| `[seed]Exercise 1` | Group A | Future (7 days) | 100 | Open for submission |
| `[seed]Exercise 2` | Group A | Past | 100 | Closed, has submissions |
| `[seed]Exercise 3` | Group A | Future (14 days) | 50 | Second deadline |
| `[seed]Exercise 1` | Group B | Future (3 days) | 100 | Different group, same exercise |
| `[seed]Exercise 4` | Group B | Future (1 day) | 100 | Urgent deadline |

---

## Submissions to Create

| Student | Assignment | Status | Score | Notes |
|---|---|---|---|---|
| `[seed]student1` | `[seed]Exercise 1` (Group A) | Passed | 95 | Recent submission |
| `[seed]student1` | `[seed]Exercise 2` (Group A) | Failed | 40 | Past submission |
| `[seed]student1` | `[seed]Exercise 3` (Group A) | Pending | — | Waiting for evaluation |
| `[seed]student2` | `[seed]Exercise 1` (Group A) | Passed | 80 | Recent submission |
| `[seed]student2` | `[seed]Exercise 1` (Group B) | Not submitted | — | Empty state |
| `[seed]sup-student1` | `[seed]Exercise 1` (Group B) | Passed | 90 | Supervisor-student as student |

---

## Script Usage

```bash
# First run (fresh database)
pnpm seed

# Re-run (idempotent — checks for `[seed]` prefix)
pnpm seed

# With custom API URL
API_BASE=http://localhost:4000/v1 pnpm seed
```

---

## Verification

After running `scripts/seed.ts`, verify:

1. All accounts can log in (test via API or UI).
2. Each user's group memberships are as specified.
3. Assignments have correct deadlines and points.
4. Submissions span all evaluation states (pending, passed, failed, none).
5. Group hierarchy is correct (A1, A2 nested under A).
6. Archived group is marked as archived.
7. `[seed]` prefix is on all created entities for easy identification.

---

## Security Note

These are **throwaway test credentials** on a disposable instance (§1). They are committed to the repo **intentionally** so a fresh session can find them without re-reading the script. They are **not** secrets.

**DO NOT** use these credentials on the production instance.

---

## Reset Procedure

To reset the test data to a known state:

1. Run `pnpm seed` — idempotent, will not duplicate existing `[seed]` entities.
2. If database is in an unknown state, ask operator to run `docker compose down -v && up -d` (operator-level, §1).
3. Re-run `pnpm seed` after reset.

**Never** attempt SQL or direct database manipulation. All operations go through the public API.