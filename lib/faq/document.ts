import "server-only";

import { connection } from "next/server";

import { resolveFaqUrl } from "./faq-url";

/** How long one fetched copy serves every reader before the next request re-fetches it. */
const REVALIDATE_SECONDS = 3600;

/** Somebody else's server would otherwise hold a page render open for as long as it liked. */
const TIMEOUT_MS = 10_000;

/**
 * The FAQ document itself (G-024): an operator-configured markdown file, fetched and rendered
 * server-side rather than by the reader's browser as the legacy app does it.
 *
 * **This is the one fetch in the app that is deliberately cached (DEC-120).** It is not
 * user-scoped -- one public document, identical for every reader, signed in or not -- so DEC-021's
 * blanket `no-store` is about a different thing entirely, and re-fetching it per page view would
 * mean a request to a third party's server every time somebody opens the page.
 *
 * `connection()` keeps the *page* out of the build-time prerender even so. `FAQ_URI` is read here,
 * at request time, and this deployment supplies its environment through compose to an image built
 * once (F-003/F-004) -- a prerendered page would bake in whatever the build host had, which is
 * nothing.
 *
 * Returns `null` for every way this can fail -- unconfigured, misconfigured, unreachable, refused,
 * timed out -- because the page says the same thing about all of them, which is legacy's own
 * "possibly due to the misconfiguration of the application". **The `response.ok` check is not
 * legacy's**: it reads the body whatever the status, so a 404 page renders as the FAQ.
 */
export async function getFaqDocument(locale: string): Promise<string | null> {
  await connection();

  const url = resolveFaqUrl(process.env.FAQ_URI, locale);
  if (url === null) return null;

  try {
    const response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
