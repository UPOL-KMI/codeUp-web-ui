import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// No explicit path passed -- next-intl's own default search order is
// ./i18n/request.{ts,tsx,js,jsx} then ./src/i18n/request.*, confirmed by reading its compiled
// plugin/getNextConfig.js rather than assumed; ./i18n/request.ts (this repo has no src/) matches.
const withNextIntl = createNextIntlPlugin();

// URL_PATH_PREFIX (legacy env.json key) maps to Next's basePath, which is resolved
// at build time, not runtime -- see docs/DECISIONS.md and DROPPED.md. Passed as a
// Docker build ARG in this repo's own Dockerfile (F-003); changing it requires a
// rebuild, not just a redeploy.
const basePath = process.env.URL_PATH_PREFIX || "";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: basePath || undefined,

  // Deliberately off -- see docs/DECISIONS.md DEF-001. Every response from core-api
  // is per-user and permission-dependent; do not flip this on without a specific
  // reason recorded there. Top-level as of 16.3.1, not under `experimental` (that
  // location is deprecated and warns on build -- verified against this exact
  // installed version, not assumed).
  cacheComponents: false,
  partialPrefetching: false,

  // Explicit root for standalone-output file tracing -- not strictly required here
  // (single app, not a monorepo; pnpm-workspace.yaml only exists for the
  // builds-approval setting), but recommended by Next's own docs and harmless.
  outputFileTracingRoot: import.meta.dirname,

  // Node File Trace's static analysis under-includes @swc/helpers: it only copies
  // its cjs/ output into .next/standalone, but require-hook.js needs esm/ at
  // runtime too. Confirmed by diffing node_modules/.pnpm/@swc+helpers@*/.../helpers/
  // between the full pnpm store and .next/standalone's copy of it (esm/ was the only
  // thing missing) after `docker run` crashed with "Cannot find module
  // .../@swc/helpers/esm/_interop_require_default.js". outputFileTracingRoot alone
  // does not fix this -- verified by testing it in isolation first.
  // The guides (X-002) are read from disk at request time, so nothing in the code names their
  // paths statically and Node File Trace cannot infer them. Without this the pages render their
  // "could not be loaded" state in the container and nowhere else.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/**",
      "./content/docs/**",
      "./content/help/**",
    ],
  },

  // **Where every legacy URL goes** (plan 004 in the compose repo, table in `docs/ROUTES.md`).
  // Needed the moment this app answers on the address the legacy one used to, which is what the
  // cutover does: otherwise every bookmark, every link in an old email and every `/app/...` path
  // anybody wrote down answers 404.
  //
  // **None of these carries a locale, and that is the point.** `redirects()` runs *before*
  // `proxy.ts`, so it cannot know what language the visitor wants. Sending to the unprefixed path
  // costs one more hop and lets `proxy.ts` negotiate; hardcoding `/en` would be cheaper and wrong
  // for half the people here.
  //
  // Order matters: Next takes the first match, so the rules that need a query string or drop a
  // path segment come before the generic `/app/:path*` sweep at the end.
  async redirects() {
    return [
      // Six legacy group screens are one screen with tabs now (DEC-071, DEC-074).
      {
        source: "/app/group/:groupId/info",
        destination: "/groups/:groupId?tab=info",
        permanent: true,
      },
      {
        source: "/app/group/:groupId/assignments",
        destination: "/groups/:groupId?tab=assignments",
        permanent: true,
      },
      {
        source: "/app/group/:groupId/students",
        destination: "/groups/:groupId?tab=students",
        permanent: true,
      },
      {
        source: "/app/group/:groupId/exams",
        destination: "/groups/:groupId?tab=exams",
        permanent: true,
      },
      {
        source: "/app/group/:groupId/exams/:examId",
        destination: "/groups/:groupId?tab=exams&exam=:examId",
        permanent: true,
      },
      {
        source: "/app/group/:groupId/edit",
        destination: "/groups/:groupId?tab=settings",
        permanent: true,
      },
      {
        source: "/app/group/:groupId/user/:userId",
        destination: "/groups/:groupId/users/:userId",
        permanent: true,
      },

      // A solution is a first-class entity here, so it no longer carries its assignment.
      { source: "/app/assignment/:a/solution/:s", destination: "/solutions/:s", permanent: true },
      {
        source: "/app/assignment/:a/solution/:s/sources",
        destination: "/solutions/:s/sources",
        permanent: true,
      },
      {
        source: "/app/assignment/:a/solution/:s/plagiarisms",
        destination: "/solutions/:s/plagiarisms",
        permanent: true,
      },
      // ROUTES.md recorded this one as having nowhere to go "until G-005 is built". It is.
      {
        source: "/app/assignment/:a/solution/:s/diff/:other",
        destination: "/solutions/:s/diff/:other",
        permanent: true,
      },

      // Singular to plural, and the `/app` prefix dropped.
      { source: "/app/assignment/:id", destination: "/assignments/:id", permanent: true },
      {
        source: "/app/assignment/:id/:rest*",
        destination: "/assignments/:id/:rest*",
        permanent: true,
      },
      // Likewise recorded as unbuilt, and shipped with G-009. Before the bare rule below it.
      {
        source: "/app/shadow-assignment/:id/edit",
        destination: "/shadow-assignments/:id/edit",
        permanent: true,
      },
      {
        source: "/app/shadow-assignment/:id",
        destination: "/shadow-assignments/:id",
        permanent: true,
      },
      { source: "/app/user/:id/edit", destination: "/users/:id/edit", permanent: true },
      { source: "/app/user/:id", destination: "/users/:id", permanent: true },

      // Screens that merged into another.
      {
        source: "/app/exercises/:e/reference-solution/:r",
        destination: "/exercises/:e/reference-solutions/:r",
        permanent: true,
      },
      {
        source: "/app/pipelines/:id/edit-struct",
        destination: "/pipelines/:id/edit",
        permanent: true,
      },
      { source: "/app/instance/:id", destination: "/admin/instances/:id", permanent: true },
      { source: "/admin/instances/:id/edit", destination: "/admin/instances/:id", permanent: true },
      { source: "/app/server", destination: "/admin", permanent: true },

      // Anonymous routes that were renamed.
      { source: "/registration", destination: "/register", permanent: true },
      { source: "/forgotten-password", destination: "/forgot-password", permanent: true },
      {
        source: "/forgotten-password/change",
        destination: "/forgot-password/change",
        permanent: true,
      },
      // **ROUTES.md's `/login/:redirect*` rule is deliberately not here**, and the reason is worth
      // keeping. Written as the table has it, it matched bare `/login` and sent it to `/login`:
      // a permanent self-redirect on the one route an unauthenticated visitor must be able to
      // reach, and the exact path this app's own logout lands on (F-017 303s to the locale-neutral
      // `/login` and lets `proxy.ts` pick the language). Two specs caught it as a login page that
      // would not load. What it would have bought is a legacy URL nobody bookmarks -- the legacy
      // app put its redirect target in a path segment, and the table already threw that target
      // away -- so the rule costs more than it is worth and `/login/<target>` is left to 404.
      //
      // The sweep, last, so every rule above wins over it.
      { source: "/app", destination: "/dashboard", permanent: true },
      { source: "/app/:path*", destination: "/:path*", permanent: true },
    ];
  },

  experimental: {
    // Enables forbidden()/unauthorized() + forbidden.tsx/unauthorized.tsx (still
    // experimental as of 16.3.1, but there's no non-experimental way to get a real
    // 403/401 status code from the App Router, and ReCodEx is permission-heavy
    // throughout -- see docs/DECISIONS.md.
    authInterrupts: true,
    // Root layout (app/[locale]/layout.tsx) uses a top-level dynamic segment, which Next's
    // own docs call out as exactly the case app/[locale]/not-found.tsx can't fully cover --
    // confirmed live: a bogus path under a valid locale prefix fell through to Next's bare
    // built-in 404, not the themed one. global-not-found.tsx (app/ root) catches genuinely
    // unmatched URLs; [locale]/not-found.tsx still handles notFound() thrown from within an
    // actually-matched segment. See docs/DECISIONS.md.
    globalNotFound: true,
  },
};

export default withNextIntl(nextConfig);
