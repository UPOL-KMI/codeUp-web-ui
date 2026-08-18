import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// Filename must be proxy.ts, not middleware.ts -- middleware.ts is a deprecated Edge-runtime
// path that silently never runs under Next.js 16 (see AGENTS.md footgun list). The exported
// function may be a default export or named `proxy` (verified in
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md); next-intl's
// own middleware() factory returns a default export, which is a supported form as-is.
export default createMiddleware(routing);

export const config = {
  // Run on everything except Next's own internals, static files, and anything with a file
  // extension (images, favicon, etc.) -- those must never get locale-prefixed or redirected.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
