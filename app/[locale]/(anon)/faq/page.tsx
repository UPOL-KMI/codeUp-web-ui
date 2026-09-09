import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getFaqDocument } from "@/lib/faq/document";
import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { Markdown } from "@/components/markdown/markdown";
import { PageShell } from "@/components/page-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Faq" });
  return { title: t("title") };
}

/**
 * The answers to the questions nobody has an account to ask yet (G-024).
 *
 * **The last placeholder in the product, and the landing page has been sending visitors to it**
 * -- `/` offers it as one of its two calls to action, `proxy.ts` keeps it public, and what it
 * answered with was "this page hasn't been built yet". That is why P-001 filed it above every
 * remaining teacher control: the gaps below it cost a signed-in professional a workaround, this
 * one is the product's first impression.
 *
 * The document is not this app's: it is an operator-configured markdown file (`FAQ_URI`,
 * defaulting to the ReCodEx wiki), the same one the legacy app fetches, rendered through the same
 * server-side `Markdown` component as every exercise text -- so a fenced snippet or a table in it
 * reads the way it does everywhere else, and none of the parsing or highlighting reaches the
 * browser. Legacy ships a stylesheet of its own for this page (`src/pages/FAQ/FAQ.css`, underlined
 * headings and a quote glyph); D-010's markdown styles already differentiate the same elements,
 * and a second set scoped to one page is how two markdown surfaces drift apart.
 *
 * Where legacy loads it in the browser and can therefore show a spinner, this renders on the
 * server: the reader waits for the page rather than watching it fill in, and the route group's
 * `loading.tsx` covers the wait.
 */
export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [breadcrumbs, t, faqText] = await Promise.all([
    resolveBreadcrumbsForNamespace("Faq", locale),
    getTranslations("Faq"),
    getFaqDocument(locale),
  ]);

  return (
    <PageShell title={breadcrumbs[breadcrumbs.length - 1]!.label} breadcrumbs={breadcrumbs}>
      {faqText === null ? (
        <div className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
          {t("loadError")}
        </div>
      ) : (
        <Markdown source={faqText} />
      )}
    </PageShell>
  );
}
