"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { routing } from "@/i18n/routing";

import { Link, usePathname } from "@/i18n/navigation";

/**
 * Reading the app in the other language (A-008).
 *
 * Two links rather than a control, so the language a reader wants is **an address they can send
 * or bookmark** -- `localePrefix: "always"` (see `i18n/routing.ts`) means every page already has
 * one URL per language, and this is just the way to reach it. next-intl's `Link` sets its own
 * `NEXT_LOCALE` cookie on the way, which is what makes the choice stick for the next visit and
 * for `/` itself.
 *
 * The current path and query are preserved, so switching language is a translation of the page
 * you are on rather than a trip to the dashboard -- including the filters and tabs this app keeps
 * in the URL, which is most of them.
 *
 * `useSearchParams()` forces the same `<Suspense>` boundary `DataTable` documents: without it, a
 * statically prerendered page (`/login`, `/register`, ...) fails to build. Wrapped here, once, so
 * no caller has to remember.
 *
 * The landmark is labelled "interface language", not "language": the submit form has a field
 * called Language (which runtime the solution is written for), and a spec reaching for it by label
 * matched this instead -- an ambiguity a screen-reader user would have hit the same way.
 */
export function LocaleSwitch() {
  return (
    <Suspense fallback={null}>
      <LocaleSwitchInner />
    </Suspense>
  );
}

function LocaleSwitchInner() {
  const t = useTranslations("Nav.locale");
  const active = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.toString();
  const href = query === "" ? pathname : `${pathname}?${query}`;

  return (
    <nav aria-label={t("label")} className="flex items-center gap-1 text-xs">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={href}
          locale={locale}
          hrefLang={locale}
          aria-current={locale === active ? "true" : undefined}
          className={`rounded-md px-2 py-1 uppercase transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            locale === active
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="sr-only">{t(`switchTo.${locale}`)}</span>
          <span aria-hidden="true">{locale}</span>
        </Link>
      ))}
    </nav>
  );
}
