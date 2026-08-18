import "server-only";
import { getTranslations } from "next-intl/server";

import type { BreadcrumbItem } from "@/components/page-shell";

interface StaticManifestEntry {
  /** The next-intl namespace whose `title` key holds this segment's label -- the same namespace
   *  every stub page (F-013) already calls `getTranslations()` with. Also this entry's own lookup
   *  key for `resolveBreadcrumbsForNamespace()`. */
  namespace: string;
  /** Full pathname this segment renders at, locale-stripped (e.g. "/forgot-password/change"). */
  pattern: string;
  resolve?: never;
}

interface DynamicManifestEntry {
  namespace?: never;
  /** Path pattern with `:param` segments, e.g. "/groups/:groupId". */
  pattern: string;
  /** Resolves this segment's own label from its matched params -- e.g. fetch a group's name. */
  resolve: (params: Record<string, string>, locale: string) => Promise<string>;
}

type ManifestEntry = StaticManifestEntry | DynamicManifestEntry;

/**
 * The one route manifest (brief footgun #12: "Breadcrumbs come from one mechanism... every page
 * renders breadcrumbs through it. No page builds its own."). Covers every currently-real route
 * (`app/[locale]/(anon)/...`, `app/[locale]/(app)/...`, F-013).
 *
 * Nested dynamic segments from `docs/IA.md` §3.2's own examples (`/groups/[groupId]`,
 * `/assignments/[id]`, `/solutions/[id]`, `/exercises/[id]`, etc.) are deliberately **not**
 * registered yet: no page for any of them exists to test a resolver against, and their entity-name
 * resolvers depend on group/assignment/exercise response shapes no ticket has confirmed yet
 * (F-022's typed client is ready to call core-api, but nothing has fetched one of these entities
 * for real). Add a `DynamicManifestEntry` here -- `{pattern: "/groups/:groupId", resolve: async
 * (params, locale) => ...}` -- in whichever ticket builds that route for real. This manifest's
 * whole purpose is being the *one* place that happens, not front-running it with a guess.
 */
const MANIFEST: ManifestEntry[] = [
  { namespace: "Dashboard", pattern: "/dashboard" },
  { namespace: "Groups", pattern: "/groups" },
  { namespace: "Exercises", pattern: "/exercises" },
  { namespace: "Pipelines", pattern: "/pipelines" },
  { namespace: "Users", pattern: "/users" },
  { namespace: "SubmissionFailures", pattern: "/submission-failures" },
  { namespace: "SystemMessages", pattern: "/system-messages" },
  { namespace: "Archive", pattern: "/archive" },
  { namespace: "Admin", pattern: "/admin" },
  { namespace: "Profile", pattern: "/profile" },
  { namespace: "Login", pattern: "/login" },
  { namespace: "Register", pattern: "/register" },
  { namespace: "ForgotPassword", pattern: "/forgot-password" },
  { namespace: "ForgotPasswordChange", pattern: "/forgot-password/change" },
  { namespace: "EmailVerification", pattern: "/email-verification" },
  { namespace: "AcceptInvitation", pattern: "/accept-invitation" },
  { namespace: "Faq", pattern: "/faq" },
];

function getPrefixes(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((_, index) => "/" + segments.slice(0, index + 1).join("/"));
}

function matchPattern(pattern: string, pathname: string): Record<string, string> | null {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSegment = patternSegments[i]!;
    const pathSegment = pathSegments[i]!;
    if (patternSegment.startsWith(":")) {
      params[patternSegment.slice(1)] = pathSegment;
    } else if (patternSegment !== pathSegment) {
      return null;
    }
  }
  return params;
}

async function resolveLabel(
  entry: ManifestEntry,
  params: Record<string, string>,
  locale: string,
): Promise<string> {
  if (entry.resolve) {
    return entry.resolve(params, locale);
  }
  const t = await getTranslations({ locale, namespace: entry.namespace });
  return t("title");
}

/**
 * Resolves the full breadcrumb chain for a locale-stripped pathname (e.g. "/forgot-password/change"
 * -> two crumbs: "Reset password" (linked) then "Change forgotten password" (current page, no
 * link)) by walking every prefix of the path and looking each up in `MANIFEST`. Throws for any
 * unregistered prefix rather than silently rendering a gap -- every real route must register
 * itself here, so a missing entry fails loudly during development instead of shipping a broken
 * breadcrumb.
 */
export async function resolveBreadcrumbs(
  pathname: string,
  locale: string,
): Promise<BreadcrumbItem[]> {
  const prefixes = getPrefixes(pathname);
  const items: BreadcrumbItem[] = [];

  for (let i = 0; i < prefixes.length; i++) {
    const prefix = prefixes[i]!;
    const entry = MANIFEST.find((candidate) => matchPattern(candidate.pattern, prefix) !== null);
    if (!entry) {
      throw new Error(
        `No breadcrumb manifest entry registered for '${prefix}' (resolving '${pathname}').`,
      );
    }
    const params = matchPattern(entry.pattern, prefix)!;
    const label = await resolveLabel(entry, params, locale);
    items.push({ label, href: i === prefixes.length - 1 ? undefined : prefix });
  }

  return items;
}

/** Convenience entry point for static pages that already identify themselves by namespace
 *  (`components/placeholder-page.tsx`) rather than knowing their own full pathname. */
export async function resolveBreadcrumbsForNamespace(
  namespace: string,
  locale: string,
): Promise<BreadcrumbItem[]> {
  const entry = MANIFEST.find((candidate) => candidate.namespace === namespace);
  if (!entry) {
    throw new Error(`No breadcrumb manifest entry registered for namespace '${namespace}'.`);
  }
  return resolveBreadcrumbs(entry.pattern, locale);
}
