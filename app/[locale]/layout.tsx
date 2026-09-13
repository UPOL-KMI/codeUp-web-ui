import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast/toast-provider";
import { pickMessages } from "@/lib/i18n-text/route-messages";
import { SHELL_MESSAGE_NAMESPACES } from "@/lib/i18n-text/route-messages.generated";

import { routing } from "@/i18n/routing";

import "../globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  // `default` is not optional alongside `template`: without it every route that supplies no title
  // of its own would render an empty <title> rather than falling back to the app name.
  return { title: { template: `%s · ${t("title")}`, default: t("title") } };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables getTranslations/getFormatter/etc. in Server Components rendered under this layout to
  // read the locale statically rather than needing it threaded through every call -- required for
  // generateStaticParams above to actually produce a static (not dynamic-per-request) route.
  setRequestLocale(locale);

  // Only what renders *outside* a page: the two shells and the error pages (PF-001). The route's
  // own share is `components/route-messages.tsx`, inside the page, because a layout two routes
  // share is not re-rendered when the reader navigates between them -- so a provider here would
  // serve the first route's messages for the rest of the session.
  const messages = pickMessages(await getMessages(), SHELL_MESSAGE_NAMESPACES);

  return (
    // suppressHydrationWarning is next-themes' own documented requirement: it sets the
    // `class`/`style` attribute on <html> before hydration (to avoid a light/dark flash),
    // which would otherwise be flagged as a server/client mismatch.
    <html lang={locale} className={plex.variable} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {/* Mounted once, here, so `useToast()` works from any client component without each
                screen providing its own notification surface (brief §9: "one toast system"). */}
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
