# ReCodEx New Frontend — Intentionally Dropped Features

**Status:** Draft
**Date:** 2026-05-11

---

## Dropped Items

| #        | Item                         | Legacy Location                   | Reason for Dropping                                                                                                                                         | Replaced By                                                  |
| -------- | ---------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| DROP-001 | **SKIN configuration**       | `etc/env.json` → `config.js`      | AdminLTE color skin. Tailwind + dark/light theme tokens provide proper theming.                                                                             | CSS custom properties, `data-theme` attribute                |
| DROP-002 | **Redux state management**   | `src/redux/` entire directory     | Server Components, Server Actions, and React Hook Form replace client-side state management for most use cases. TanStack Query handles client-side caching. | Server Components, Server Actions, TanStack Query            |
| DROP-003 | **redux-form**               | `src/redux/modules/`              | React Hook Form + Zod provides better TypeScript support and performance.                                                                                   | React Hook Form + Zod schemas                                |
| DROP-004 | **immutable.js**             | `src/redux/reducer.js`, selectors | Plain JavaScript objects with TypeScript are simpler and sufficient.                                                                                        | Plain objects, TypeScript interfaces                         |
| DROP-005 | **redux-storage**            | `src/redux/store.js`              | Client state is minimal; `localStorage` persistence replaced by httpOnly cookie for auth, URL searchParams for UI state.                                    | httpOnly cookie, `searchParams`, `localStorage` (theme only) |
| DROP-006 | **redux-promise-middleware** | `src/redux/middleware/`           | Native `async/await` and Server Actions replace promise middleware.                                                                                         | `async`/`await`, Server Actions                              |
| DROP-007 | **moment.js**                | `src/helpers/`                    | Deprecated, heavy. `date-fns` + native `Intl.DateTimeFormat` are sufficient.                                                                                | `date-fns`, `Intl` API                                       |
| DROP-008 | **moment-timezone**          | `src/helpers/`                    | Server sends absolute ISO dates. Client formats relative times using `Intl.RelativeTimeFormat`.                                                             | Server-side absolute dates, client-side `Intl`               |
| DROP-009 | **Webpack configuration**    | `webpack.config.js`, `.babelrc`   | Next.js built-in Turbopack handles bundling. No custom Webpack config needed.                                                                               | Next.js Turbopack                                            |
| DROP-010 | **Babel configuration**      | `.babelrc`                        | Next.js built-in SWC compiler replaces Babel.                                                                                                               | Next.js SWC                                                  |
| DROP-011 | **Express server**           | `src/server.js`, `bin/www`        | Next.js provides its own server (`output: 'standalone'`). No custom Express server needed.                                                                  | Next.js built-in server                                      |
| DROP-012 | **mocha/chai test suite**    | `test/` directory                 | Legacy tests are for Redux modules and helpers. New tests use Vitest + Playwright.                                                                          | Vitest (unit), Playwright (E2E)                              |
| DROP-013 | **react-bootstrap**          | `package.json` dependency         | AdminLTE/Bootstrap components replaced by shadcn/ui + Tailwind CSS.                                                                                         | shadcn/ui + Tailwind CSS                                     |
| DROP-014 | **AdminLTE 4**               | `package.json` dependency         | Legacy admin dashboard template. Replaced by modern, custom design system.                                                                                  | shadcn/ui + Tailwind CSS + custom PageShell                  |
| DROP-015 | **react-intl**               | `package.json` dependency         | `next-intl` is App Router-native and works in Server Components.                                                                                            | `next-intl`                                                  |
| DROP-016 | **highlight.js**             | `package.json` dependency         | Shiki provides better server-side rendering and theme support.                                                                                              | Shiki (server-side)                                          |
| DROP-017 | **prismjs**                  | `package.json` dependency         | Shiki replaces both highlight.js and Prism for code display.                                                                                                | Shiki (server-side)                                          |
| DROP-018 | **react-syntax-highlighter** | `package.json` dependency         | Shiki + custom component replaces react-syntax-highlighter.                                                                                                 | Shiki + custom CodeViewer component                          |
| DROP-019 | **react-ace**                | `package.json` dependency         | Ace Editor is heavyweight. CodeMirror 6 is more modern, accessible, and extensible.                                                                         | CodeMirror 6 (client-only via `next/dynamic`)                |
| DROP-020 | **viz.js (Graphviz WASM)**   | `package.json` dependency         | Large client-only payload. Decision deferred: port initially, evaluate alternatives (server-side Graphviz, JS layout library).                              | Pending decision — see `DECISIONS.md` DEF-003                |

---

## Pending Decision (Not Yet Dropped)

| #        | Item                                  | Status        | Notes                                                                                                                                                                                                                                     |
| -------- | ------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PEND-001 | **WebSocket for evaluation progress** | Deferred      | Legacy uses `monitor` service. Check if running in this deployment. Polling is simpler, WebSocket is real-time. Decision: `DEF-004` in `DECISIONS.md`.                                                                                    |
| PEND-002 | **Extension token handoff**           | Investigating | Legacy `SIS-ext-webapp` repo receives a token. Conflicts with §5's "token never reaches client JS". Investigate mechanism, implement most conservative approach. See `QUESTIONS.md` Q-012.                                                |
| PEND-003 | **Markdown rendering compatibility**  | Testing       | Legacy uses `markdown-it` + `@iktakahiro/markdown-it-katex`. `react-markdown` + `rehype-katex` may differ on raw HTML, KaTeX delimiters, table edge cases. Test with real data before dropping legacy renderer. See `QUESTIONS.md` Q-013. |

---

## Notes

- **URL_PATH_PREFIX runtime configurability:** Legacy reads `URL_PATH_PREFIX` from `etc/env.json` at runtime. Next.js `basePath` is resolved at build time. This is a **build-time limitation** that must be documented. Workaround: rebuild with different `basePath` for different deployments. Recorded here because it is a behavior change, not a missing feature.
- **Login page redirect parameter:** Legacy login accepts `:redirect?` parameter in URL (`/login/:redirect?`). Next.js Route Handlers handle redirects via `searchParams`, not path parameters. This is a **structural change** that improves URL cleanliness (`/login?redirect=/dashboard` instead of `/login/dashboard`).
- **Shadow assignment routes:** Legacy has `/app/shadow-assignment/:shadowId` and `/app/shadow-assignment/:shadowId/edit`. New IA moves these to `/shadow-assignments/[id]` and `/shadow-assignments/[id]/edit` for consistency with plural noun conventions (`/groups`, `/assignments`, `/exercises`).
- **Instance admin routes:** Legacy splits between `/app/server` (ServerManagement) and `/admin/instances` (Instances). New IA consolidates under `/admin/server` and `/admin/instances` for clearer separation of admin vs. app functionality.
- **Submission failures route:** Legacy has `/app/submission-failures`. New IA moves to `/submission-failures` (top-level) since it is an admin/teacher diagnostic view, not tied to a specific group or assignment context.

---

## Verification

Before marking a dropped item as `done`, verify:

1. The replacement is fully functional and tested.
2. No legacy capability is lost (check `INVENTORY.md`).
3. The reason for dropping is documented and justified.
4. Any behavior changes are recorded in this document.
5. The operator has been informed of significant drops (via `PROGRESS.md` observations).
