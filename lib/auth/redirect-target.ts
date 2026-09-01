/**
 * Where to go after signing in.
 *
 * `proxy.ts` puts the page somebody was refused into `?from=`, and this is what turns that back
 * into a destination. **It is an open-redirect guard first and a convenience second**: a `from`
 * that is anything but a path on this app -- `//evil.example`, `https://evil.example`, a
 * backslash-prefixed path some browsers normalise -- is discarded in favour of the dashboard. A
 * sign-in form that will forward the browser wherever a link says is a phishing tool.
 *
 * Locale-agnostic on purpose: `proxy.ts` writes the locale-prefixed pathname, and next-intl's
 * `Link`/`router` prefix again, so the prefix is stripped here and re-added by whoever navigates.
 */
const LOCALE_PREFIX = /^\/(en|cs)(?=\/|$)/;

export function safeRedirectTarget(from: string | undefined, fallback = "/dashboard"): string {
  if (!from) return fallback;
  // A single leading slash, and nothing that could be read as an authority or a scheme.
  if (!from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) return fallback;
  if (from.includes("://")) return fallback;
  const stripped = from.replace(LOCALE_PREFIX, "");
  return stripped === "" ? fallback : stripped;
}
