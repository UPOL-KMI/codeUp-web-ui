/**
 * The two interface preferences this app carries (G-022), and what they are allowed to be.
 *
 * Vocabulary rather than data, so it is client-safe -- the settings form and the Zod schema it
 * shares with its Server Action both need it, the same reason `./user-roles.ts` is not
 * `server-only`.
 *
 * **The legacy "Visual Settings" panel had nine keys and seven of them are not here.** Five were
 * obsoleted by this app's redesign, one is superseded by a better-placed setting, and one has no
 * destination in this IA; each is recorded in `docs/DROPPED.md` by name rather than left to be
 * noticed. G-022's own instruction was "either build the two or record all seven item by item",
 * and this is both halves of that.
 */

/**
 * Where signing in lands (`defaultPage`).
 *
 * Legacy offered three: `dashboard`, `home` and `instance`. The first two are routes in this app;
 * **the third is not**, because this IA has no general instance page -- AD-004/AD-005 built the
 * administrator's instance screens behind `/admin` (DEC-113), and what a reader actually wants to
 * know about their instance (its name, what it is for) is on the landing page A-001 built. So a
 * stored `instance` is read as `home`, which is the nearest true thing rather than a 404.
 */
export const DEFAULT_PAGES = ["dashboard", "home"] as const;

export type DefaultPage = (typeof DEFAULT_PAGES)[number];

const DEFAULT_PAGE_ROUTES: Record<DefaultPage, string> = {
  dashboard: "/dashboard",
  home: "/",
};

/** Reads whatever is stored -- including legacy's `instance` -- into a route this app has. */
export function defaultPageRoute(stored: string | null | undefined): string {
  if (stored === "home" || stored === "instance") return DEFAULT_PAGE_ROUTES.home;
  return DEFAULT_PAGE_ROUTES.dashboard;
}

/** Reads whatever is stored into one of the two the form offers, for showing it back. */
export function defaultPageValue(stored: string | null | undefined): DefaultPage {
  return stored === "home" || stored === "instance" ? "home" : "dashboard";
}

/**
 * Which language's conventions absolute dates are formatted in, regardless of the interface
 * language (`dateFormatOverride`). Legacy's own two options, and its own semantics: empty means
 * "follow the interface language", which is what every reader gets until they say otherwise.
 *
 * Scoped to **absolute** dates on purpose. A relative time ("3 days ago") is phrasing rather than
 * numerals, so an override would either do nothing or produce a Czech phrase on an English page;
 * D-012 renders those client-side and they keep following the interface language.
 */
export const DATE_FORMAT_LOCALES = ["cs", "en"] as const;

export type DateFormatLocale = (typeof DATE_FORMAT_LOCALES)[number];

export function dateFormatValue(stored: string | null | undefined): DateFormatLocale | "" {
  return stored === "cs" || stored === "en" ? stored : "";
}
