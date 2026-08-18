import type { Metadata } from "next";
import Link from "next/link";

// Bypasses the normal app/[locale]/... tree entirely (Next's own docs: "doesn't depend on
// rendering a layout or page"), so it can't reach next-intl's request-scoped locale, routing
// context (plain next/link, not the locale-aware wrapper from @/i18n/navigation), or the theme
// provider -- must import its own styles and can't call getTranslations(). Hardcoded bilingual
// text is the pragmatic exception to "no hardcoded user-facing strings" here, same reasoning as
// app/global-error.tsx.
import "./globals.css";

export const metadata: Metadata = {
  title: "ReCodEx",
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <main>
          <h1>Page not found / Stránka nenalezena</h1>
          <p>
            The page you&apos;re looking for doesn&apos;t exist. / Stránka, kterou hledáte,
            neexistuje.
          </p>
          <Link href="/">Go home / Domů</Link>
        </main>
      </body>
    </html>
  );
}
