import { getTranslations } from "next-intl/server";

/**
 * Shared shell for route-skeleton stub pages (F-013): proves the URL/route-group structure now,
 * without building real UI ahead of the ticket that owns it (D-series PageShell, then the
 * relevant S-/T-/A-/AD- ticket). Every stub page's own title is translated per-page; only the
 * "not built yet" copy is shared.
 */
export async function PlaceholderPage({ title }: { title: string }) {
  const t = await getTranslations("Placeholder");

  return (
    <main>
      <h1>{title}</h1>
      <p>{t("comingSoon")}</p>
    </main>
  );
}
