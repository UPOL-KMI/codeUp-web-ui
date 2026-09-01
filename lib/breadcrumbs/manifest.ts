import "server-only";
import { getTranslations } from "next-intl/server";

import { getGroupInvitation } from "@/lib/api/group-invitation";
import { apiRead } from "@/lib/api/read";
import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import type { BreadcrumbItem } from "@/components/page-shell";

interface StaticManifestEntry {
  /** The next-intl namespace whose `title` key holds this segment's label -- the same namespace
   *  every stub page (F-013) already calls `getTranslations()` with. Also this entry's own lookup
   *  key for `resolveBreadcrumbsForNamespace()`. */
  namespace: string;
  /** Full pathname this segment renders at, locale-stripped (e.g. "/forgot-password/change"). */
  pattern: string;
  /** Set where the segment names a section that has no page of its own -- `/assignments` exists
   *  only as the parent of `/assignments/:id` (`docs/IA.md` §2). Its crumb renders as plain text;
   *  linking it would send the user to a route that does not exist and, worse, have Next prefetch
   *  a 404 from every page that shows the crumb. */
  unlinked?: boolean;
  resolve?: never;
}

interface DynamicManifestEntry {
  namespace?: never;
  unlinked?: never;
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
 * The three dynamic entries below were added by D-014/D-015, as this file's original note asked
 * ("add a `DynamicManifestEntry` here in whichever ticket builds that route for real"): the
 * sidebar links to groups and the command palette links to groups, exercises and users, and their
 * response shapes are now confirmed against a live instance rather than guessed. Their pages are
 * still route skeletons; the breadcrumb is real. `/assignments/:assignmentId` joined them in
 * S-001, for the same reason: the dashboard links every open assignment, and
 * `/solutions/:solutionId` joined in S-002, whose review queues link every solution waiting on a
 * teacher.
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
  { namespace: "GroupInvitation", pattern: "/accept-group-invitation", unlinked: true },
  { namespace: "Faq", pattern: "/faq" },
  { namespace: "Account", pattern: "/profile/edit" },
  { namespace: "Assignment", pattern: "/assignments", unlinked: true },
  { namespace: "Solutions", pattern: "/solutions", unlinked: true },
  { namespace: "Shadow", pattern: "/shadow-assignments", unlinked: true },
  // A leaf with a static label under a dynamic parent: `matchPattern` handles the `:param`
  // segment, and the label is this page's own namespace title like any other static entry.
  { namespace: "Submit", pattern: "/assignments/:assignmentId/submit" },
  {
    namespace: "AssignmentSolutions",
    pattern: "/assignments/:assignmentId/solutions",
  },
  { namespace: "Sources", pattern: "/solutions/:solutionId/sources" },
  { namespace: "Plagiarism", pattern: "/solutions/:solutionId/plagiarisms" },
  // `/assignments/:id/users` is a path segment with no page of its own, like `/assignments`.
  { namespace: "Users", pattern: "/assignments/:assignmentId/users", unlinked: true },

  // Dynamic segments. Each fetches the entity's own display name -- in a Server Component, so no
  // client-side waterfall (docs/IA.md §3.2). Groups and exercises carry no top-level `name`; their
  // labels live in a `localizedTexts` array, verified live (see lib/i18n-text/localized.ts).
  {
    pattern: "/groups/:groupId",
    resolve: async (params, locale) => {
      const group = await apiRead<{ localizedTexts?: LocalizedText[] }>("/v1/groups/{id}", {
        pathParams: { id: params.groupId! },
      });
      return localizedName(group.localizedTexts, locale);
    },
  },
  {
    pattern: "/exercises/:exerciseId",
    resolve: async (params, locale) => {
      const exercise = await apiRead<{ localizedTexts?: LocalizedText[] }>("/v1/exercises/{id}", {
        pathParams: { id: params.exerciseId! },
      });
      return localizedName(exercise.localizedTexts, locale);
    },
  },
  {
    // A shadow assignment carries its name in `localizedTexts` like every other named entity.
    pattern: "/shadow-assignments/:shadowId",
    resolve: async (params, locale) => {
      const assignment = await apiRead<{ localizedTexts?: LocalizedText[] }>(
        "/v1/shadow-assignments/{id}",
        { pathParams: { id: params.shadowId! } },
      );
      return localizedName(assignment.localizedTexts, locale);
    },
  },
  {
    pattern: "/assignments/:assignmentId",
    resolve: async (params, locale) => {
      const assignment = await apiRead<{ localizedTexts?: LocalizedText[] }>(
        "/v1/exercise-assignments/{id}",
        { pathParams: { id: params.assignmentId! } },
      );
      return localizedName(assignment.localizedTexts, locale);
    },
  },
  {
    // A solution has no name of its own. The attempt number is what distinguishes it from the
    // author's other attempts at the same assignment, and is what the legacy UI labels it by.
    pattern: "/solutions/:solutionId",
    resolve: async (params, locale) => {
      const [solution, t] = await Promise.all([
        apiRead<{ attemptIndex?: number }>("/v1/assignment-solutions/{id}", {
          pathParams: { id: params.solutionId! },
        }),
        getTranslations({ locale, namespace: "Solutions" }),
      ]);
      return t("crumb", { attempt: solution.attemptIndex ?? 1 });
    },
  },
  {
    // The group is what the reader is being invited to, so it is the crumb -- not the invitation's
    // own uuid, which names nothing. `getGroupInvitation` is memoized, so this shares the page's
    // own fetch rather than adding one.
    pattern: "/accept-group-invitation/:invitationId",
    resolve: async (params, locale) => {
      const [invitation, t] = await Promise.all([
        getGroupInvitation(params.invitationId!, locale),
        getTranslations({ locale, namespace: "GroupInvitation" }),
      ]);
      return invitation.group.name || t("unnamedGroup");
    },
  },
  {
    pattern: "/users/:userId",
    resolve: async (params) => {
      const user = await apiRead<{ fullName?: string }>("/v1/users/{id}", {
        pathParams: { id: params.userId! },
      });
      return user.fullName ?? "";
    },
  },
  {
    pattern: "/assignments/:assignmentId/users/:userId",
    resolve: async (params) => {
      const user = await apiRead<{ fullName?: string }>("/v1/users/{id}", {
        pathParams: { id: params.userId! },
      });
      return user.fullName ?? "";
    },
  },
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
    const isCurrentPage = i === prefixes.length - 1;
    items.push({ label, href: isCurrentPage || entry.unlinked ? undefined : prefix });
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
