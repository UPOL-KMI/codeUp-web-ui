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
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/**"],
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
