import "server-only";

/**
 * Where a visitor goes to sign in through somebody else's identity provider (A-007).
 *
 * **There is no page to port here, and that is the finding.** The legacy app opens CAS in a
 * **popup**, and its `LoginExternFinalization` screen exists only to serve that popup: it reads the
 * token out of its own URL, `postMessage`s it to the window that opened it, waits to be told the
 * message arrived, and closes itself. F-019 built this app's side as a plain **redirect** target
 * instead (`/api/auth/external/{name}/callback`), so there is no second window, no `postMessage`
 * handshake, and nothing for that page to do (DEC-117).
 *
 * What was genuinely missing is the way *in*: the callback and its failure state were built and
 * nothing ever sent anybody to the provider. This is that -- the same three configuration values
 * the legacy app reads (`EXTERNAL_AUTH_URL`, `EXTERNAL_AUTH_SERVICE_ID`, `EXTERNAL_AUTH_NAME`),
 * and the same condition for showing the control: both the URL and the service id must be set.
 *
 * **The URL is used exactly as configured, with nothing appended.** The legacy app does the same
 * (`openPopupWindow(EXTERNAL_AUTH_URL)`, no query parameters), because where the provider sends
 * the browser back to is the provider's own configuration, not something this app may decide. The
 * service id has to match the `{authenticatorName}` in the callback path, since that is what
 * core-api verifies the returned token's signature against.
 *
 * Null on this deployment: it configures no `EXTERNAL_AUTH_*` at all (Q-004), which is why the
 * sign-in page shows no such button and why this path cannot be exercised end to end here.
 */
export interface ExternalAuthProvider {
  /** Where to send the browser. Configured whole; nothing is appended to it. */
  url: string;
  /** core-api's `authenticatorName`; must match the callback route's segment. */
  service: string;
  /** What to call it on the button -- a provider's own name ("CAS UK"), not a translated word. */
  name: string;
}

export function externalAuthProvider(): ExternalAuthProvider | null {
  const url = process.env.EXTERNAL_AUTH_URL ?? "";
  const service = process.env.EXTERNAL_AUTH_SERVICE_ID ?? "";
  if (url === "" || service === "") return null;

  return { url, service, name: process.env.EXTERNAL_AUTH_NAME || service };
}
