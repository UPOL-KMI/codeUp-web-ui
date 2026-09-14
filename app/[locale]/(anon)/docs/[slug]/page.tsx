import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { GUIDE_SLUGS, getGuide, isGuideSlug } from "@/lib/docs/guides";
import { guideOutline } from "@/lib/docs/outline";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { buttonClasses } from "@/components/button";
import { GuideOutline } from "@/components/docs/guide-outline";
import { Markdown } from "@/components/markdown/markdown";
import { Link } from "@/i18n/navigation";
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

  const index = GUIDE_SLUGS.indexOf(slug);
  const previous = GUIDE_SLUGS[index - 1];
  const next = GUIDE_SLUGS[index + 1];

  return (
    <PageShell title={t(`guides.${slug}.title`)} breadcrumbs={breadcrumbs}>
      {source === null ? (
        <div className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
          {t("loadError")}
        </div>
      ) : (
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start lg:gap-12">
          {/* First in the document, so a reader arriving by keyboard or screen reader meets the
              outline before the text it outlines; the grid puts it beside the text on a wide screen. */}
          <GuideOutline
            entries={guideOutline(source)}
            label={t("onThisPage")}
            className="lg:sticky lg:top-6 lg:order-last"
          />
          <div className="flex min-w-0 flex-col gap-10">
            <div className="max-w-3xl text-base leading-relaxed">
              <Markdown source={source} />
            </div>
            <nav
              aria-label={t("neighbours")}
              className="flex max-w-3xl flex-wrap items-center justify-between gap-3 border-t border-border pt-6"
            >
              {previous ? (
                <Link href={`/docs/${previous}`} className={buttonClasses("outline", "sm")}>
                  <span aria-hidden="true">←</span>
                  {t(`guides.${previous}.title`)}
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link href={`/docs/${next}`} className={buttonClasses("outline", "sm")}>
                  {t(`guides.${next}.title`)}
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </PageShell>
  );
}
