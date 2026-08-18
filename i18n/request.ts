import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale (not next/root-params) -- root-params is next-intl's documented replacement,
  // but it isn't actually usable yet: `next`'s package.json lists root-params.js/.d.ts in its
  // "files" field, but neither file exists in the installed 16.3.1 package. Verified by checking
  // node_modules directly, not assumed. Revisit once it actually ships.
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
