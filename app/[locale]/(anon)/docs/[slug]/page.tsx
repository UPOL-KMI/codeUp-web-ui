import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getGuide, isGuideSlug } from "@/lib/docs/guides";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Markdown } from "@/components/markdown/markdown";
import { PageShell } from "@/components/page-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!isGuideSlug(slug)) return {};
  const t = await getTranslations({ locale, namespace: "Docs" });
  return { title: t(`guides.${slug}.title`) };
}

/**
 * One guide (X-002), rendered through the same markdown pipeline as an exercise text -- so a table
 * or a fenced command in it reads the way tables and fences read everywhere else in the product,
 * and none of the parsing or highlighting reaches the browser.
 *
 * A slug that is not a guide is a 404 rather than an empty page: the three are a closed set, and
 * `/docs/anything-else` was never a URL this app offered.
 */
export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!isGuideSlug(slug)) notFound();

  const [breadcrumbs, t, source] = await Promise.all([
    resolveBreadcrumbs(`/docs/${slug}`, locale),
    getTranslations("Docs"),
    getGuide(slug, locale),
  ]);

  return (
    <PageShell title={t(`guides.${slug}.title`)} breadcrumbs={breadcrumbs}>
      {source === null ? (
        <div className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
          {t("loadError")}
        </div>
      ) : (
        <div className="max-w-3xl text-base leading-relaxed">
          <Markdown source={source} />
        </div>
      )}
    </PageShell>
  );
}
