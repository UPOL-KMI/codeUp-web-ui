import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { maybeRefreshSession } from "./lib/auth/refresh-session";
import {
  isSessionTokenLive,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "./lib/auth/session-cookie";
import { routing } from "./i18n/routing";

// Filename must be proxy.ts, not middleware.ts -- middleware.ts is a deprecated Edge-runtime
// path that silently never runs under Next.js 16 (see AGENTS.md footgun list).
const intlMiddleware = createMiddleware(routing);

// Pages under app/[locale]/(anon)/... where showing the form to an already-signed-in visitor is
// unambiguously pointless -- redirected to /dashboard if a session cookie is present. Kept
// separate from the rest of (anon) (forgot-password, email-verification, accept-invitation, faq),
// which stay reachable regardless of auth state -- a signed-in user resetting a password, or
// just reading the FAQ, is a normal thing to do.
const AUTH_ONLY_PATHNAMES = new Set(["/login", "/register"]);

// Every other page reachable without a session -- app/[locale]/(anon)/... minus the two above,
// plus "/" (the still-unclassified placeholder root from F-001/F-011, see docs/DECISIONS.md).
// Route groups don't appear in the URL, so this list is kept in sync with that folder by hand;
// there's no way to introspect it at runtime.
const PUBLIC_PATHNAMES = new Set([
  "/",
  "/forgot-password",
  "/forgot-password/change",
  "/email-verification",
  "/accept-invitation",
  "/faq",
  // D-013's component showcase. Renders no user data and calls no user-scoped endpoint, so a
  // session requirement would only make it harder to look at (its upload section does hit
  // core-api, and says so). Deliberately kept out of the (anon) route group -- it isn't part of
  // the product's IA, it's developer tooling that happens to be served by the same app.
  "/dev/design-system",
]);

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

/**
 * UX redirect only -- brief §5: "proxy.ts is not a security boundary." Four of the thirteen
 * May 2026 advisories were middleware/proxy bypasses; the actual authorisation boundary is
 * requireSession() in the server-side data access layer (F-015), called by every function that
 * touches core-api, not by this file. All this does is avoid flashing a page that's about to
 * fail, or showing a login form to someone who's already signed in. The cookie is read, never
 * *trusted*: its signature is not verified here or anywhere in this app, and the only thing this
 * file decides from it is whether it is worth treating as a session at all. It does have to decide
 * that much -- presence alone was not enough, and the gap was an infinite redirect loop (F-031).
 *
 * Also handles proactive token refresh (brief §5: "Token refresh and expiry handling happen in
 * proxy.ts or Route Handlers only" -- Server Components can't set cookies). Applied to whichever
 * response ends up being returned, not just the pass-through case, so a session close to expiry
 * gets refreshed even on a request that also happens to redirect.
 */
export default async function proxy(request: NextRequest) {
  const intlResponse = intlMiddleware(request);

  // next-intl wants to redirect for locale reasons (bare "/dashboard" -> "/en/dashboard", or a
  // detected-locale mismatch) -- let that happen first. The browser's follow-up request hits us
  // again with a resolved locale, and the auth check below applies cleanly then.
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  const locale = request.nextUrl.pathname.split("/")[1];
  const pathname = stripLocale(request.nextUrl.pathname);
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  // A cookie that is past its own `exp` is not a session, and treating it as one was a redirect
  // loop, not a cosmetic problem (F-031): `/dashboard`'s `requireSession()` sent the reader to
  // `/login`, the branch below saw a cookie and sent them back, forever. Same predicate as
  // `requireSession()` uses, so the two cannot disagree.
  const staleSession = sessionCookie !== undefined && !isSessionTokenLive(sessionCookie.value);
  const hasSession = sessionCookie !== undefined && !staleSession;

  let response: NextResponse;

  if (AUTH_ONLY_PATHNAMES.has(pathname) && hasSession) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = `/${locale}/dashboard`;
    dashboardUrl.search = "";
    response = NextResponse.redirect(dashboardUrl);
  } else if (!AUTH_ONLY_PATHNAMES.has(pathname) && !PUBLIC_PATHNAMES.has(pathname) && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${locale}/login`;
    loginUrl.search = "";
    loginUrl.searchParams.set("from", request.nextUrl.pathname + request.nextUrl.search);
    response = NextResponse.redirect(loginUrl);
  } else {
    response = intlResponse;
  }

  if (staleSession) {
    // Cleared here rather than left for the reader to notice: this is the only layer that both
    // sees the request and can write a cookie, and every later layer would otherwise keep being
    // told there is a session. `maxAge: 0` with the same options it was set with -- a delete that
    // misses `path` leaves the original in place.
    response.cookies.set(SESSION_COOKIE_NAME, "", sessionCookieOptions(0));
  } else if (sessionCookie) {
    const refreshed = await maybeRefreshSession(sessionCookie.value);
    if (refreshed) {
      response.cookies.set(
        SESSION_COOKIE_NAME,
        refreshed.token,
        sessionCookieOptions(refreshed.maxAgeSeconds),
      );
    }
  }

  return response;
}

export const config = {
  // Run on everything except Next's own internals, static files, and anything with a file
  // extension (images, favicon, etc.) -- those must never get locale-prefixed or redirected.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
