/**
 * What a person may ask for when they mint an application token of their own (G-020), and how that
 * choice becomes core-api's request body.
 *
 * **The one module in `lib/auth/` with no `import "server-only"`, deliberately.** Everything else
 * here touches the session cookie or core-api and must never reach the browser; this is the
 * opposite -- a closed vocabulary and one pure function, used by the form in the browser and by
 * its test. Do not add the marker out of habit: it would break the form.
 *
 * **A scope narrows, it never widens.** core-api's own words in the legacy form: "the scopes may
 * restrict the set of operations authorized by the token beyond the limitations of the user role".
 * So an issued token is the intersection of the scope asked for and what the asker could already
 * do, which is why none of this is an authorisation decision -- `checkIssueRestrictedToken()`
 * requires the caller's own token to carry `master`, and `validateScopeRoles()` refuses the two
 * scopes that may only arrive by email. Both were verified live against this deployment.
 */

/** core-api's `TokenScope`, minus the ones no form may ask for -- read off that class, not guessed. */
export const TOKEN_SCOPES = ["master", "read-all", "plagiarism", "ref-solutions"] as const;

/**
 * `group-external` is offered to a superadmin only, matching the legacy form's own `isSuperAdmin`
 * branch -- and worth recording precisely, because **core-api does not itself refuse it to anybody**
 * (`validateScopeRoles` forbids only `change-password` and `email-verification`, and caps
 * `master`'s lifetime; there is no role test for this scope at all). It is hidden rather than
 * guarded: a token scoped to managing groups externally, issued to somebody who may not manage
 * groups, intersects down to a credential that can do nothing -- an offer worth not making.
 *
 * `users` and `extensions` exist in `TokenScope` and are in neither form. `extensions` is for the
 * handshake temp tokens core-api mints itself, and `users` is for syncing accounts from an outside
 * directory, which is a deployment's own integration rather than a thing a person asks for here.
 */
export const SUPERADMIN_TOKEN_SCOPES = [...TOKEN_SCOPES, "group-external"] as const;

export type TokenScope = (typeof SUPERADMIN_TOKEN_SCOPES)[number];

/**
 * The lifetimes the form offers, in seconds.
 *
 * The legacy form's own five, with one number corrected: its "1 Year" is `356 * DAY`, nine days
 * short of a year and plainly a typo for 365. Nothing depends on the value being one of these --
 * core-api takes any positive integer -- so the fix costs nothing and the wrong number was only
 * ever going to be copied forward.
 *
 * **Any of them can still be refused, and the form does not pretend otherwise.** `master` is
 * capped at the deployment's own configured token lifetime, which core-api does not publish, so
 * there is no ceiling to mirror here -- its refusal names the limit and is shown verbatim. On this
 * deployment a week-long `master` token was issued without complaint; on a stricter one it would
 * not be.
 */
export const TOKEN_EXPIRATIONS = [3600, 86400, 604800, 2678400, 31536000] as const;

export type TokenExpiration = (typeof TOKEN_EXPIRATIONS)[number];

export interface RestrictedTokenChoice {
  scope: TokenScope;
  expiration: number;
  /** Whether the token may renew itself for as long as it keeps being used. */
  refresh: boolean;
}

export interface RestrictedTokenRequest {
  scopes: string[];
  expiration: number;
}

/**
 * **`refresh` is a second scope, not a flag**, which is the one thing about this endpoint a caller
 * gets wrong: core-api reads `TokenScope::REFRESH` out of the same array, so "allow refreshing"
 * means asking for two scopes rather than setting a property. Kept in one place, with a test, so
 * the form cannot drift from the body.
 */
export function restrictedTokenRequest(choice: RestrictedTokenChoice): RestrictedTokenRequest {
  return {
    scopes: choice.refresh ? [choice.scope, "refresh"] : [choice.scope],
    expiration: choice.expiration,
  };
}
