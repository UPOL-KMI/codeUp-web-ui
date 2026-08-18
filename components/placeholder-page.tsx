import { getLocale, getTranslations } from "next-intl/server";

import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { PageShell } from "./page-shell";

/**
 * Shared shell for route-skeleton stub pages (F-013): proves the URL/route-group structure now,
 * without building real UI ahead of the ticket that owns it (D-001 PageShell, D-002 breadcrumb
 * manifest, then the relevant S-/T-/A-/AD- ticket). Only the "not built yet" copy is shared;
 * `namespace` identifies which page this is -- the same next-intl namespace each caller used to
 * pass its own resolved `title` before D-002, now used to look this page up in the central
 * breadcrumb manifest (`lib/breadcrumbs/manifest.ts`) instead. The page's `<h1>` title is the
 * breadcrumb chain's own last crumb, not a second, separately-resolved translation call -- one
 * resolution path for both, so they can never drift apart.
 */
export async function PlaceholderPage({ namespace }: { namespace: string }) {
  const locale = await getLocale();
  const [breadcrumbs, t] = await Promise.all([
    resolveBreadcrumbsForNamespace(namespace, locale),
    getTranslations("Placeholder"),
  ]);
  const title = breadcrumbs[breadcrumbs.length - 1]!.label;

  return (
    <PageShell title={title} breadcrumbs={breadcrumbs}>
      <p className="text-muted-foreground">{t("comingSoon")}</p>
    </PageShell>
  );
}
