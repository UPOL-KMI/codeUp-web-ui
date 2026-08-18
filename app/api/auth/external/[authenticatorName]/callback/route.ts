import { NextResponse } from "next/server";

import { establishSession } from "@/lib/auth/session-cookie";
import { buildAbsoluteUrl } from "@/lib/http/absolute-url";

/**
 * External auth (CAS-and-similar) callback (brief §5). GET, not POST: this is a browser redirect
 * target, not an AJAX call -- whatever external identity provider authenticated the user redirects
 * here directly.
 *
 * **The actual mechanism, read from core-api's own PHP source
 * (`ExternalServiceAuthenticator::decodeToken()`), not assumed or guessed from the brief's short
 * description:** core-api does not talk to CAS, or to any external provider, itself. Each
 * `authenticatorName` is configured server-side in core-api with a pre-shared `jwtSecret`; this
 * route's whole job is to receive a `token` query param that's *already* a JWT signed with that
 * secret (by whatever external identity bridge is configured for `authenticatorName` -- entirely
 * external to this app and to core-api) and hand it to `POST /v1/login/{authenticatorName}`,
 * which verifies the signature and issues a real ReCodEx session token in return. There is no
 * ticket-exchange step for this app to perform.
 *
 * The `token` query param name (not `ticket`) matches the legacy app's actual wired-in page,
 * `repos/web-app/src/pages/LoginExternFinalization/LoginExternFinalization.js` -- confirmed by
 * reading it, not `repos/web-app/src/helpers/cas.js`'s hardcoded `idp.cuni.cz` URLs and `ticket`
 * param, which describe a specific university's own external bridge infrastructure (outside this
 * project's repos entirely), not the general mechanism core-api itself implements. `[authenticatorName]`
 * is a dynamic segment, not hardcoded to one provider, matching core-api's own
 * `/login/{authenticatorName}` and the legacy config's generic `EXTERNAL_AUTH_SERVICE_ID`.
 *
 * **Genuinely unverifiable end-to-end in this environment**: this deployment has no
 * `EXTERNAL_AUTH_*` configured at all (`docs/QUESTIONS.md` Q-004) -- no authenticator name, no
 * shared secret, nothing to obtain a real signed token from. What *is* verified live (both `next
 * dev` and a real `output: standalone` Docker build): an unknown `authenticatorName` correctly
 * 400s from core-api ("Unknown external authenticator name"), and this route correctly turns that
 * (and a missing `token`) into a redirect to `/login` with an error flag rather than an unhandled
 * exception. Also specifically confirmed in the Docker build (via temporary logging, since this is
 * exactly where DEC-039's `request.url` bug was originally found): although `request.url`'s origin
 * is wrong under `standalone` (reads the container's internal bind address, not the real Host), its
 * path+query portion is intact -- `new URL(request.url).searchParams.get("token")` reads the real
 * query param correctly, so this route (unlike the redirects, which all go through
 * `buildAbsoluteUrl()`) is safe to read `request.url` directly for this purpose. The success path
 * (`establishSession` from a validly-signed external token) reuses the exact same code as F-016's
 * login, already verified there against a real token -- but the specific call chain to this route
 * has not been exercised with a real external authenticator, and can't be until one is configured
 * operationally.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ authenticatorName: string }> },
) {
  const { authenticatorName } = await params;
  const token = new URL(request.url).searchParams.get("token");

  if (token) {
    const apiBase = process.env.API_BASE_INTERNAL;
    if (!apiBase) {
      throw new Error("API_BASE_INTERNAL is not set.");
    }

    const apiResponse = await fetch(`${apiBase}/login/${encodeURIComponent(authenticatorName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (apiResponse.ok) {
      const { payload } = (await apiResponse.json()) as { payload: { accessToken: string } };
      if (await establishSession(payload.accessToken)) {
        return NextResponse.redirect(buildAbsoluteUrl(request, "/dashboard"), 303);
      }
    }
  }

  return NextResponse.redirect(buildAbsoluteUrl(request, "/login?externalAuthError=1"), 303);
}
