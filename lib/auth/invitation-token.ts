import "server-only";

/**
 * The invitation token core-api mails out, read for display (S-024).
 *
 * A different JWT from the session token `jwt.ts` decodes, with its own claims -- core-api builds
 * it in `App\Security\InvitationToken::create`: `iid` the instance, `eml` the email that becomes
 * the login name, `usr` the person's name as exactly four strings (titles before, first, last,
 * titles after), `grp` the groups they join on registration, `xid` the identifiers other systems
 * know them by, plus `iat`/`exp`. `xid` is this deployment's own addition to the fork, so a token
 * issued before it simply has none.
 *
 * **Not verified here, and it does not need to be.** core-api signed it and re-checks the
 * signature on `POST /v1/users/accept-invitation`, which is the call that actually creates the
 * account; nothing is granted on the strength of what this function returns. The worst a forged
 * token achieves is a page showing a name its own author typed, followed by core-api refusing it.
 *
 * Decoded on the server rather than in the browser (which is where the legacy page does it), so
 * no JWT parsing ships to the client and the page hands the form the four strings it renders
 * instead of a payload to pick apart. The raw token is separate: it is already in the address bar,
 * and the form has to send it back, so passing it through is not an exposure -- see DEC-084.
 */
export interface InvitationClaims {
  email: string;
  titlesBeforeName: string;
  firstName: string;
  lastName: string;
  titlesAfterName: string;
  issuedAt: number;
  expiresAt: number;
  hasExpired: boolean;
  /** How many groups accepting will enrol the person in. core-api silently skips any that have
   *  been deleted, archived or made organizational since, so this is an upper bound. */
  groupCount: number;
  /**
   * Identifiers other systems know this person by (`stag` and the like), recorded on the account
   * when the invitation is accepted. **Shown to them**, because it is personal data about them
   * that somebody else typed and this is the one moment they can see it before it becomes part of
   * their account -- and a mistyped study number is far cheaper to catch here than later.
   */
  externalIds: Record<string, string>;
}

/** `xid` is a JSON object of strings, or absent. Anything else is ignored rather than trusted. */
function readExternalIds(raw: unknown): Record<string, string> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "",
    ),
  );
}

export function decodeInvitationToken(token: string): InvitationClaims | null {
  const parts = token.split(".");
  const payloadPart = parts[1];
  if (parts.length !== 3 || !payloadPart) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload !== "object" || payload === null) return null;
  const claims = payload as Record<string, unknown>;

  // core-api's own validation, restated: `usr` must be exactly four strings, and it is what the
  // page renders, so a token shaped differently is not one this screen can describe.
  const name = claims.usr;
  if (
    typeof claims.eml !== "string" ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number" ||
    !Array.isArray(name) ||
    name.length !== 4 ||
    name.some((part) => typeof part !== "string")
  ) {
    return null;
  }

  const [titlesBeforeName, firstName, lastName, titlesAfterName] = name as string[];

  return {
    email: claims.eml,
    titlesBeforeName: titlesBeforeName ?? "",
    firstName: firstName ?? "",
    lastName: lastName ?? "",
    titlesAfterName: titlesAfterName ?? "",
    issuedAt: claims.iat,
    expiresAt: claims.exp,
    hasExpired: claims.exp * 1000 <= Date.now(),
    groupCount: Array.isArray(claims.grp) ? claims.grp.length : 0,
    externalIds: readExternalIds(claims.xid),
  };
}
