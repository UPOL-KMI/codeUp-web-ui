import { getTranslations } from "next-intl/server";

import { PageShell } from "./page-shell";

/**
 * Shared shell for route-skeleton stub pages (F-013): proves the URL/route-group structure now,
 * without building real UI ahead of the ticket that owns it (D-series PageShell, then the
 * relevant S-/T-/A-/AD- ticket). Every stub page's own title is translated per-page; only the
 * "not built yet" copy is shared.
 *
 * Routed through `PageShell` (D-001) with a single-crumb breadcrumb (just this page's own title,
 * no parent chain) -- real breadcrumb chains are D-002's job (the central route manifest with
 * async entity-name resolvers), not something to fake here ahead of that ticket.
 */
export async function PlaceholderPage({ title }: { title: string }) {
  const t = await getTranslations("Placeholder");

  return (
    <PageShell title={title} breadcrumbs={[{ label: title }]}>
      <p className="text-muted-foreground">{t("comingSoon")}</p>
    </PageShell>
  );
}
