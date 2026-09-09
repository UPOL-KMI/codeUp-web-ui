/**
 * Which document the FAQ page shows, given how the operator configured `FAQ_URI` (G-024).
 *
 * The legacy app's own variable with the legacy app's own semantics (`src/pages/FAQ/FAQ.js`): one
 * URL for every locale, or a per-locale mapping that falls back to English and then to whatever is
 * there. Unset means the ReCodEx project's public wiki -- the legacy default, and the reason this
 * page says something useful on a deployment nobody has configured.
 *
 * Legacy reads that variable out of a JSON config file, so the mapping form arrives there as an
 * object; here it is an environment variable, so it arrives as JSON text and is parsed. A value
 * that is neither parseable nor an absolute http(s) URL resolves to `null`, which the page renders
 * as legacy's "could not be loaded" -- this app fetches the document **server-side**, so a
 * mistyped variable must not decide what its own server connects to.
 */
export const DEFAULT_FAQ_URI = "https://raw.githubusercontent.com/wiki/ReCodEx/wiki/FAQ.md";

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:" ? value : null;
}

export function resolveFaqUrl(configured: string | undefined, locale: string): string | null {
  const raw = configured?.trim();
  if (!raw) return DEFAULT_FAQ_URI;
  if (!raw.startsWith("{")) return httpUrl(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const byLocale = parsed as Record<string, unknown>;
  const anyLocale = Object.values(byLocale)
    .map(httpUrl)
    .find((url) => url !== null);

  return httpUrl(byLocale[locale]) ?? httpUrl(byLocale.en) ?? anyLocale ?? null;
}
