import { ROUTE_MESSAGE_NAMESPACES } from "./route-messages.generated";

/** Set by `proxy.ts`, read by `app/[locale]/layout.tsx`: the locale-stripped path being rendered. */
export const PATHNAME_HEADER = "x-recodex-pathname";

/**
 * Which of the message catalogue a page actually hands to the browser (PF-001).
 *
 * `<NextIntlClientProvider>` rendered without `messages` defaults to the **whole** catalogue --
 * 126,514 bytes, 85% of a document like `/faq`, all 63 namespaces on every page whether or not any
 * client component there can reach one. P-003 measured it as the largest single saving in the
 * project.
 *
 * The set is per route, because that is where the difference is: the median route's client subtree
 * asks for 2,968 bytes of it and the largest (`/groups/[groupId]`) for 14,821. A route-group split
 * was measured too and is not worth having -- it leaves `(app)` at 82,175 bytes, and `(app)` is
 * most of the product.
 */

/** Falls back to everything: an unmatched route is then merely as heavy as it was before PF-001. */
export function namespacesForRoute(pathname: string | null): readonly string[] | null {
  if (pathname === null) return null;
  const exact = ROUTE_MESSAGE_NAMESPACES[pathname];
  if (exact) return exact;

  const segments = pathname.split("/").filter(Boolean);
  for (const [route, namespaces] of Object.entries(ROUTE_MESSAGE_NAMESPACES)) {
    const pattern = route.split("/").filter(Boolean);
    if (pattern.length !== segments.length) continue;
    const matches = pattern.every(
      (segment, index) =>
        (segment.startsWith("[") && segment.endsWith("]")) || segment === segments[index],
    );
    if (matches) return namespaces;
  }
  return null;
}

type Messages = Record<string, unknown>;

/**
 * The sub-tree of `messages` covering exactly `namespaces`, each of which may be a dotted path
 * (`"Solution.evaluation"`), since that is what `useTranslations` is called with.
 *
 * **A namespace that does not resolve is skipped rather than throwing.** The generator reads the
 * source, the catalogue is edited by hand, and the one that notices a mismatch is
 * `messages.test.ts` -- whose job it already is. Throwing here would turn a missing string into a
 * blank page instead of the missing-key marker next-intl renders.
 */
export function pickMessages(messages: Messages, namespaces: readonly string[]): Messages {
  const picked: Messages = {};
  // Widest first, so a namespace whose parent has already been taken whole can be skipped rather
  // than descending into -- and *writing into* -- the catalogue's own objects. Getting this the
  // other way round dropped `Solution.title` when a route asked for `Solution.evaluation` and
  // `Solution` both; the unit test for it was written before the bug was.
  const ordered = [...new Set(namespaces)].sort(
    (a, b) => a.split(".").length - b.split(".").length || a.localeCompare(b),
  );
  const taken: string[] = [];

  for (const namespace of ordered) {
    if (taken.some((prefix) => namespace === prefix || namespace.startsWith(`${prefix}.`)))
      continue;

    const parts = namespace.split(".");
    let source: unknown = messages;
    for (const part of parts) {
      source =
        typeof source === "object" && source !== null ? (source as Messages)[part] : undefined;
      if (source === undefined) break;
    }
    if (source === undefined) continue;

    let target = picked;
    for (const part of parts.slice(0, -1)) {
      if (typeof target[part] !== "object" || target[part] === null) target[part] = {};
      target = target[part] as Messages;
    }
    target[parts[parts.length - 1]!] = source;
    taken.push(namespace);
  }

  return picked;
}
