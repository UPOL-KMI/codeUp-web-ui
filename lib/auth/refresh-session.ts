import "server-only";

import { decodeJwtPayload } from "./jwt";

// Refresh proactively once less than this much time remains, so a session that's merely idle
// (not yet actually expired) gets a fresh token before requireSession()'s own exp check would
// reject it. Tokens last 7 days by default on this deployment (confirmed live login responses,
// F-015/F-016); a day of buffer is generous without refreshing on every request near the token's
// start.
const REFRESH_THRESHOLD_SECONDS = 24 * 60 * 60;

export interface RefreshedSession {
  token: string;
  maxAgeSeconds: number;
}

// Coalesces concurrent refresh attempts for the *same* token value into a single upstream call --
// the "concurrent-refresh race guard" brief §5 calls for by name. Keyed by the token itself, not
// userId: two requests presenting the identical not-yet-refreshed cookie value are, by
// definition, the same session state; once one succeeds the cookie changes, so a later request
// naturally lands on a fresh map entry rather than reusing a stale one. Module-level state --
// correct within a single running Node.js process (this app's current deployment, ASS-004), not
// across horizontally-scaled replicas; see docs/DECISIONS.md.
const inFlightRefreshes = new Map<string, Promise<RefreshedSession | null>>();

/**
 * Refreshes the session token if (and only if) it's close enough to expiry to be worth it.
 * Returns null if no refresh was needed, or if the refresh attempt failed -- callers should treat
 * null as "keep using the existing cookie," not as an error. A failed refresh doesn't mean the
 * current token is invalid *right now*, and forcing a redirect from a UX-only layer (proxy.ts,
 * brief §5) over a transient upstream problem would be exactly the over-reach that layer must
 * avoid.
 *
 * Confirmed live against core-api (not assumed): refreshing does **not** invalidate the token it
 * was called with -- both the old and new tokens kept working afterward. This means a *missed*
 * de-duplication here would waste a redundant upstream call, not corrupt anyone's session --
 * still worth avoiding, but the failure mode brief §5 warns about ("invalidate each other") isn't
 * how this specific API actually behaves. See docs/DECISIONS.md.
 *
 * Also confirmed live: core-api's JWTs are second-granularity deterministic (HMAC-SHA256 over a
 * payload whose only varying field is `iat`) -- refreshing twice within the same wall-clock
 * second yields a byte-identical token, not a bug in this function. The concurrent de-duplication
 * itself was verified by counting actual upstream calls (via temporary logging, not committed),
 * not by comparing resulting token strings, precisely because that determinism would make
 * accidental duplicate calls made in the same second look deduplicated when they weren't.
 */
export async function maybeRefreshSession(token: string): Promise<RefreshedSession | null> {
  const claims = decodeJwtPayload(token);
  if (!claims) return null;

  const secondsRemaining = claims.exp - Date.now() / 1000;
  if (secondsRemaining > REFRESH_THRESHOLD_SECONDS) return null;

  const existing = inFlightRefreshes.get(token);
  if (existing) return existing;

  const promise = refreshToken(token).finally(() => {
    inFlightRefreshes.delete(token);
  });
  inFlightRefreshes.set(token, promise);
  return promise;
}

async function refreshToken(token: string): Promise<RefreshedSession | null> {
  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) return null;

  try {
    const response = await fetch(`${apiBase}/login/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;

    const { payload } = (await response.json()) as { payload: { accessToken: string } };
    const claims = decodeJwtPayload(payload.accessToken);
    if (!claims) return null;

    return {
      token: payload.accessToken,
      maxAgeSeconds: Math.max(0, Math.floor(claims.exp - Date.now() / 1000)),
    };
  } catch {
    return null;
  }
}
