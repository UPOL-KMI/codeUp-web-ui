import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ORIGIN_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { buildAbsoluteUrl } from "@/lib/http/absolute-url";

/**
 * Auth BFF logout (brief §5 / DEC-038's Route Handler pattern, same as login). core-api has no
 * logout/invalidate endpoint (confirmed against docs/swagger.yaml -- only /login, /login/refresh,
 * /login/takeover exist) and the legacy app's own logout is a local action with no API call
 * (repos/web-app/src/redux/helpers/api/tools.js), so this is purely a BFF-side operation: clear
 * the cookie, nothing to tell core-api.
 *
 * POST only, not GET -- logout is a mutation (ends a session), and a GET-triggered logout is a
 * classic (if low-severity here) CSRF footgun, e.g. an `<img>` tag from another origin. Redirects
 * to the locale-neutral `/login` rather than a specific `/{locale}/login`: this route lives
 * outside app/[locale]/..., so it has no resolved locale of its own to redirect into -- letting
 * the request fall through proxy.ts's existing locale detection again is simpler and more
 * reliable than re-deriving the user's locale here (e.g. from Referer, which isn't always sent).
 * Uses a 303 so the browser re-requests the redirect target with GET, not a replayed POST.
 *
 * Builds the redirect target with `buildAbsoluteUrl()` (`lib/http/absolute-url.ts`), not
 * `new URL("/login", request.url)` -- see that module's doc comment and DEC-039 for why
 * `request.url` can't be trusted here.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  // Takes the takeover stash with it: an administrator's token must not outlive their session.
  cookieStore.delete(ORIGIN_COOKIE_NAME);

  return NextResponse.redirect(buildAbsoluteUrl(request, "/login"), 303);
}
