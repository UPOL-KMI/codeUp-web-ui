import "server-only";
import { headers } from "next/headers";

/**
 * Builds an absolute URL for a redirect from inside a Route Handler, using the request's own
 * `Host` header rather than `request.url`.
 *
 * `request.url` is unreliable under `output: standalone` (confirmed live, DEC-039): it reflects
 * the server's own internal bind address (`HOSTNAME`/`PORT` from the Dockerfile, e.g.
 * "0.0.0.0:3000"), not the address the request actually arrived on. `Host` was confirmed correct
 * in the same live check. A bare relative path doesn't work as a substitute either --
 * `NextResponse.redirect()` throws ("Please use only absolute URLs") despite its parameter being
 * typed to accept a plain string, also confirmed live.
 *
 * `pathname` should start with `/`. Falls back to `API_BASE_PUBLIC`'s own host/protocol if `Host`
 * is somehow absent (it shouldn't be, on any real HTTP request).
 */
export function buildAbsoluteUrl(request: Request, pathname: string): string {
  const fallback = new URL(process.env.API_BASE_PUBLIC ?? "http://localhost");
  const host = request.headers.get("host") ?? fallback.host;
  const protocol = fallback.protocol;

  return `${protocol}//${host}${pathname}`;
}

/**
 * The origin this app is being served from, for a Server Component that has to *show* a URL rather
 * than redirect to one (T-018's invitation links).
 *
 * Same `Host`-over-`request.url` reasoning as above, read from `headers()` because a Server
 * Component has no `Request`. Deliberately not derived from `API_BASE_PUBLIC`: that names core-api,
 * which is the same origin in the compose deployment and a different port in local development --
 * so it would print a link that works in production and quietly does not on a developer's machine.
 */
export async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const fallback = new URL(process.env.API_BASE_PUBLIC ?? "http://localhost");
  const host = headerList.get("host") ?? fallback.host;
  const protocol = headerList.get("x-forwarded-proto") ?? fallback.protocol.replace(":", "");

  return `${protocol}://${host}`;
}
