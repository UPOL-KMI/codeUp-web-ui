# ReCodEx New Frontend — Intentionally Dropped

**Status:** Rewritten against the built app, P-007, 2026-09-02
**Date:** 2026-05-11 (recon draft), rewritten 2026-09-02

Brief §3 constraint 3 is what this file exists for: _"Every capability reachable in the legacy app
must be reachable here. Rearranged, renamed, merged — fine. Dropped — only if recorded and justified
in `docs/DROPPED.md`."_

**Read this first, because the recon draft of this file invited exactly the wrong inference.** It
listed twenty items, and nineteen of them were **libraries**, not capabilities — dropping `moment.js`
for `date-fns` drops nothing a user can do. A reader could come away believing that this file
enumerates everything absent from the new app. It does not, and never did.

What is absent divides in three, and only the first of them belongs here:

| Kind                                            | Where it is recorded                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| A capability deliberately not carried across    | **This file, part 1.** Each row says who decided and why                             |
| A capability simply not built yet               | **`BACKLOG.md`, G-001..G-029.** P-001 found 29 of them; they are work, not decisions |
| A library, build tool or state pattern replaced | **This file, part 3.** No user-visible capability is involved                        |

If you are looking for "what does the new app not do", the answer is the **second** row, not this
file.

---

## Part 1 — Capabilities deliberately not carried across

Four, and each of them is a decision somebody wrote down at the time, with a reason and a named
alternative. Every other legacy capability is either built or filed as a G-ticket.

| #        | Capability                                                          | Legacy location                                       | Why it is not here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Where it is decided     |
| -------- | ------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| DROP-C01 | **Returning to your own account after a takeover**                  | `UserPanel`, the `userSwitching` module's second half | Legacy keeps every account you have taken over in a client-side list and lets you switch back. Here a takeover is **a sign-in, not a mode**: core-api issues an ordinary token for the target carrying nothing that names the administrator, so there is nothing to switch back to, and the confirmation says so. The way back is to sign out and sign in. Doing it properly means a second cookie holding the administrator's own token and a route to swap it — an auth-model change, not a button  | DEC-112                 |
| DROP-C02 | **Assignment settings collected during a bulk assign**              | `ExerciseAssignments`' multi-group assign dialog      | The bulk assign itself ships (`/exercises/[id]/assignments`, one request per group with per-group outcomes). What is not carried is filling in deadlines and points **once** for all of them. Same reasoning as DEC-093 for the single-group path: core-api has no call that creates an assignment and configures it, so the wizard would hold settings in the browser until the end and lose them if the tab closed. Assignments are created invisible; each one's settings screen is one click away | DEC-093                 |
| DROP-C03 | **Choosing which page you land on, and six other view preferences** | `EditUser`'s "Visual Settings" panel                  | **Provisional — this is the one row here that may move.** Five of the seven preferences (surnames first, open-row-on-double-click, sidebar folding, editor font size, Vim mode) describe interactions this IA does not have; two (`defaultPage`, `dateFormatOverride`) still mean something. Recorded here rather than silently, but **G-022 is the ticket that decides between building the two and dropping all seven properly**                                                                    | G-022 (open)            |
| DROP-C04 | **`URL_PATH_PREFIX` as a runtime setting**                          | legacy `env.json`, read at runtime                    | Next resolves `basePath` at **build** time; there is no runtime equivalent. The value is a Docker build ARG here, so changing where the app is mounted needs a rebuild rather than a restart. The capability (mount under a path prefix) survives; the ability to change it without rebuilding does not                                                                                                                                                                                               | `next.config.ts`, F-003 |

**Not in this table on purpose:** the effective-role switch ("view as a student") and the
application-token form. Both were _deferred_ in DEC-043 to "a future ticket", and that ticket was
never filed — which made them read as decisions when they were oversights. They are now G-023 and
G-020. A deferral with no ticket behind it is not a drop.

---

## Part 2 — Questions the recon draft left open, now answered

| #        | Question                              | Answer                                                                                                                                                                                                                                                                           |
| -------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PEND-001 | **WebSocket for evaluation progress** | **Kept, and it is both.** The solution page refreshes itself on a timer so the result renders once, on the server; the monitor socket is layered on top where a channel id exists, connecting directly to the monitor as the legacy app does. DEF-004 is closed                  |
| PEND-002 | **Extension token handoff**           | **Still open** (DEF-005). This deployment has no external extension configured, so nothing can be observed. The legacy app's own general-purpose answer — a user minting a scoped token for themselves — is G-020, and building that is the conservative move the brief asks for |
| DROP-020 | **viz.js (Graphviz WASM)**            | **Dropped, and the capability kept.** Pipeline graphs are laid out by a pure function and drawn as SVG **on the server** (`lib/pipelines/{layout,svg}.ts`), so nothing is added to the client bundle and the picture is in the HTML. DEF-003 is closed by DEC-107                |

---

## Part 3 — Libraries and build tooling replaced

No user-visible capability is involved in any of these. They are here because the recon draft put
them here and removing them would lose the record of what replaced what.

| #        | Legacy                                                           | Replaced by                                                                                                                              |
| -------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| DROP-001 | AdminLTE SKIN configuration (`env.json` → `config.js`)           | CSS custom properties + `data-theme`                                                                                                     |
| DROP-002 | Redux, `redux-form`, `redux-storage`, `redux-promise-middleware` | Server Components, Server Actions, React Hook Form + Zod, `searchParams` for view state                                                  |
| DROP-003 | `immutable.js`                                                   | Plain objects and TypeScript types                                                                                                       |
| DROP-004 | `moment.js`, `moment-timezone`                                   | `date-fns` + `Intl`; absolute dates from the server, relative formatting in the browser (hydration, AGENTS.md footgun 6)                 |
| DROP-005 | Webpack + Babel                                                  | Turbopack + SWC, both built in                                                                                                           |
| DROP-006 | Express server (`src/server.js`, `bin/www`)                      | Next's own server, `output: "standalone"`                                                                                                |
| DROP-007 | mocha/chai suite over Redux modules and helpers                  | Vitest for pure logic, Playwright against a real API                                                                                     |
| DROP-008 | `react-bootstrap`, AdminLTE 4                                    | Radix primitives + Tailwind, `PageShell`, `DataTable`                                                                                    |
| DROP-009 | `react-intl`                                                     | `next-intl`, which works in Server Components                                                                                            |
| DROP-010 | `highlight.js`, `prismjs`, `react-syntax-highlighter`            | Shiki, server-side                                                                                                                       |
| DROP-011 | `react-ace`                                                      | Nothing yet — no in-browser code editor exists. This is why G-028 (a markdown preview) is the only thing left of the "CodeMirror 6" plan |
| DROP-012 | `react-diff-viewer`                                              | **Nothing.** This one is not a library swap, and it is not a drop either — it is G-005, the one brief §7 landmine that was stepped on    |
| DROP-013 | `viz.js` (Graphviz WASM)                                         | Server-side layout + SVG (see PEND/DROP-020 above)                                                                                       |

The last two rows are in this table because the recon draft put the libraries here, and they are the
two places where "we replaced the library" quietly meant "we did not replace the capability". Left
visible rather than tidied away.

---

## What would go in this file next

A row here needs three things: the capability in a sentence a user would recognise, the legacy file
that proves it existed, and the decision id that carries the reasoning. A row without a decision id
is a G-ticket wearing a disguise — that is how DROP-C03 got its "provisional" note, and it should
either gain a decision or become work.
