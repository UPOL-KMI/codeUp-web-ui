import "server-only";

export interface JwtPayload {
  sub: string;
  exp: number;
}

/**
 * Reads a JWT's payload claims without verifying its signature -- this app never needs to verify
 * signatures locally. core-api is the only party that ever needs to (it signed the token, and it
 * re-validates the Authorization header on every request we make with it); re-checking our own
 * signature here would only prove we can read what we just wrote. Shared by require-session.ts
 * (decode our own session cookie) and the login/CAS Route Handlers (size the cookie's `maxAge`
 * against the token's real `exp`) so the parsing logic can't drift between the two.
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  const payloadPart = parts[1];
  if (parts.length !== 3 || !payloadPart) return null;

  try {
    const payload: unknown = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof (payload as { sub?: unknown }).sub !== "string" ||
      typeof (payload as { exp?: unknown }).exp !== "number"
    ) {
      return null;
    }
    return payload as JwtPayload;
  } catch {
    return null;
  }
}
