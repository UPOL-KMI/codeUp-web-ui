import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

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
 * Builds the redirect target from the `Host` header, not `new URL("/login", request.url)`:
 * confirmed live (a temporary debug endpoint, not committed) that under `output: standalone`,
 * `request.url` in a Route Handler reflects the server's own internal bind address
 * (HOSTNAME/PORT from the Dockerfile, e.g. "0.0.0.0:3000") rather than the `Host` header the
 * request actually arrived with -- `proxy.ts`'s `request.nextUrl` doesn't have this problem
 * (verified in F-014), only plain `Request.url` in a standalone-served Route Handler. A bare
 * relative path doesn't work either: `NextResponse.redirect()` throws ("Please use only absolute
 * URLs"), confirmed live -- it genuinely requires an absolute URL, unlike what its `string`-typed
 * parameter suggests. `Host` (unlike `request.url`) was confirmed correct in the same live check.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  const host =
    request.headers.get("host") ?? new URL(process.env.API_BASE_PUBLIC ?? "http://localhost").host;
  const protocol = new URL(process.env.API_BASE_PUBLIC ?? "http://localhost").protocol;

  return NextResponse.redirect(`${protocol}//${host}/login`, 303);
}
