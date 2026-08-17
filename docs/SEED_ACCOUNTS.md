# ReCodEx New Frontend — Seed Test Accounts

**Status:** Implemented (F-025), verified idempotent against a live instance.
**Date:** 2026-08-17

This replaces the recon-phase plan that used to live here (Group A/B/C names, `seed-student1`
style credentials) — those never matched what `scripts/seed.ts` actually builds. See
`docs/DECISIONS.md` and `docs/PROGRESS.md`'s F-025 entry for the API recipe and the bugs found
along the way.

---

## Accounts

All passwords are the single fixed value below — not a secret, throwaway test data on a
disposable instance (brief §1).

**Password for every seeded account (except the superadmin): `RecodexSeed123!`**

| Email | Global Role | Group Memberships | Purpose |
|---|---|---|---|
| `admin@admin.com` | `superadmin` | — | **Not created by this script** — the deployment's own first-boot seed. Password `admin`. Reused as-is per the brief. |
| `alice.student@seed.recodex.local` | `student` | Student of **Intro to Programming** | Plain student, mixed submission states |
| `sam.supervisor@seed.recodex.local` | `supervisor` | Admin of **Intro to Programming**, plain supervisor (non-admin) of **Retired Course** | Admin of one group, plain member of another |
| `sasha.mentor@seed.recodex.local` | `supervisor-student` | Admin of **Large Lecture**, plain student of **Intro to Programming / Lab A** | The brief's §2 "one person, two audiences" case |
| `seed.filler.01@seed.recodex.local` … `seed.filler.25@seed.recodex.local` | `student` | Students of **Large Lecture** | Pagination filler — 25 accounts |

Override the admin credentials the script logs in as via `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` env vars if you ever change them on the deployment.

---

## Groups

| Name | Parent | Archived | Purpose |
|---|---|---|---|
| `[seed] Intro to Programming` | — | No | Primary group; has a subgroup |
| `[seed] Intro to Programming / Lab A` | Intro to Programming | No | Satisfies "one group has a subgroup" |
| `[seed] Retired Course` | — | **Yes** | Satisfies "one archived group". Archived *after* adding sam.supervisor as a member — see the `group.isNotArchived` gotcha below |
| `[seed] Large Lecture` | — | No | Pagination stress: 25 students, 25 assignments |

---

## Exercise

Exactly **one** exercise, `[seed] Echo Greeting` (python3, stdin→stdout diff against a fixed
expected output), reused across every assignment below instead of building a new exercise per
assignment — see `docs/DECISIONS.md` for the full API recipe and why. It has one reference
solution (required before an exercise can be assigned to any group at all).

---

## Assignments

| Group | Count | Notes |
|---|---|---|
| Intro to Programming | 2 | One with `alice.student`'s submissions (below), one left untouched — the brief's "at least one assignment with nothing submitted yet" |
| Large Lecture | 25 | Pagination filler, staggered deadlines, no submissions |

## Submissions

| Student | Assignment | Note (idempotency key) | Content |
|---|---|---|---|
| alice.student | Intro to Programming's primary assignment | `[seed] correct` | Prints the exact expected greeting |
| alice.student | same | `[seed] wrong` | Prints something else, deliberately incorrect |

**These do not currently reach genuine pass/fail on this dev machine.** This Mac's Docker
Desktop runs cgroup v2 only; the vendored `isolate` 1.8.1 sandbox requires cgroup v1 (see
`../ReCOdex/README.md`, "Before going to production, read this: `worker` needs cgroup v1" — a
pre-existing, already-documented limitation, not something introduced by this script). Every
submission resolves to an infrastructure `evaluation_failure` (`Isolate init error`) instead of a
real judged result. Re-verify the actual pass/fail split on a cgroup v1 host — production, or a
locally fixed Docker config — before relying on this for evaluation-state UI work.

---

## Running it

```bash
pnpm seed
```

Reads `API_BASE_INTERNAL` (falling back to `API_BASE_PUBLIC`) from `.env.local` via
`tsx --env-file=.env.local`. Safe to re-run any number of times — every entity is looked up by a
fixed `[seed]` name/note before creating, so re-running does not duplicate anything. Verified: a
clean re-run against fully-seeded state produces zero creates (all `exists, reused` / `already
exists, skipping submit`).

---

## A real gotcha worth remembering

`POST /v1/groups/{id}/members/{userId}` (and `/students/{userId}`) checks `group.isNotArchived`
against the **group**, but ALSO checks `becomeMember`/similar against the **target user's own
role's ACL** — and that check also requires `group.isNotArchived`. Concretely: **you cannot add
any member to an already-archived group**, even as superadmin. `scripts/seed.ts` archives
`[seed] Retired Course` as the *last* step for that group, after `sam.supervisor` is already a
member — do not reorder this if you touch the script.

---

## Resetting

Wiping the database is an **operator-level** action outside this script's reach — `docker compose
down -v && up -d` in `../ReCOdex/`, not something `scripts/seed.ts` does or assumes. After a wipe,
just run `pnpm seed` again; it starts from "just the seeded superadmin" and rebuilds everything.

**Never** attempt SQL or direct database manipulation — every operation in `scripts/seed.ts` goes
through the public API, by design (brief §1).
