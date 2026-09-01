/**
 * Reading a token out of a link core-api put in an email.
 *
 * **The token is the whole query string**, not a named parameter: core-api builds these links from
 * templates like `"%webapp.address%/accept-invitation?{token}"` and
 * `"%webapp.address%/forgotten-password/change?{token}"` (`WebappLinks.php`), so what arrives is
 * `?eyJhbGciOi...` with no key at all. A deployment that overrides those templates could name it,
 * so `?token=` is read too rather than assumed away.
 *
 * Extracted from S-024's invitation page when the password-reset link (A-005) turned out to arrive
 * the same way -- two pages reading a URL the same way is one function, not two copies.
 */
export function readQueryToken(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const named = searchParams.token;
  if (typeof named === "string" && named !== "") return named;

  // `?<jwt>` parses as a single key with an empty value. A JWT is three base64url segments joined
  // by dots -- no `=`, `&` or `?` -- so it survives that round trip unchanged.
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === "" && key.split(".").length === 3) return key;
  }
  return null;
}
