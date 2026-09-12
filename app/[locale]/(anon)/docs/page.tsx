import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { GUIDE_SLUGS } from "@/lib/docs/guides";
import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Docs" });
  return { title: t("title") };
}

/**
 * The signpost (X-002): three guides, one for each audience the product actually has.
 *
 * Public, like the FAQ and for the same reason -- somebody deciding whether to install this, or a
 * student who cannot sign in, are both people the documentation is for, and requiring an account
 * to read how to get an account is a circle.
 */
export default async function DocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [breadcrumbs, t] = await Promise.all([
    resolveBreadcrumbsForNamespace("Docs", locale),
    getTranslations("Docs"),
  ]);

  return (
    <PageShell
      title={breadcrumbs[breadcrumbs.length - 1]!.label}
      breadcrumbs={breadcrumbs}
      subtitle={t("intro")}
    >
      <ul className="flex flex-col gap-3">
        {GUIDE_SLUGS.map((slug) => (
          <li key={slug}>
            <Link
              href={`/docs/${slug}`}
              className="flex flex-col gap-1 rounded-lg border border-border p-4 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="text-sm font-semibold">{t(`guides.${slug}.title`)}</span>
              <span className="text-sm text-muted-foreground">{t(`guides.${slug}.summary`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
