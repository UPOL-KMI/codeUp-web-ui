import type { NextConfig } from "next";

// URL_PATH_PREFIX (legacy env.json key) maps to Next's basePath, which is resolved
// at build time, not runtime -- see docs/DECISIONS.md and DROPPED.md. Passed as a
// Docker build arg in services/<name>/Dockerfile once that exists (F-003/F-004);
// changing it requires a rebuild, not just a redeploy.
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
};

export default nextConfig;
