import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { headers } from "next/headers";

import { namespacesForRoute, PATHNAME_HEADER, pickMessages } from "@/lib/i18n-text/route-messages";

/**
 * The page's own share of the message catalogue (PF-001).
 *
 * **This has to live inside the page, not in the layout, and finding out why cost a red suite.**
 * A first version put it in `app/[locale]/layout.tsx`, which is correct on a fresh load and wrong
 * on every client-side navigation after it: the App Router does not re-render a layout that two
 * routes share, so the provider kept the messages of whichever route the reader happened to land
 * on first. 43 e2e tests went red, all of them ones that *click* rather than `goto` -- a form whose
 * labels had vanished because its island threw `MISSING_MESSAGE`. A page re-renders on navigation,
 * so the provider goes there.
 *
 * The set is complete for the subtree rather than additive: next-intl's inner provider **replaces**
 * its parent's messages rather than merging them (`use-intl`'s `IntlProvider` computes
 * `messages: v === undefined ? parent?.messages : v`), so what is picked here is the route's own
 * namespaces *and* the shell's, which is what the generated map holds.
 *
 * An unmatched path renders the provider without `messages`, which is next-intl's "all of them" --
 * a route added without regenerating the map is as heavy as it was before PF-001, never wordless.
 */
export async function RouteMessages({ children }: { children: React.ReactNode }) {
  const namespaces = namespacesForRoute((await headers()).get(PATHNAME_HEADER));
  if (namespaces === null) return <NextIntlClientProvider>{children}</NextIntlClientProvider>;

  return (
    <NextIntlClientProvider messages={pickMessages(await getMessages(), namespaces)}>
      {children}
    </NextIntlClientProvider>
  );
}
