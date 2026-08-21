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
    // D-012. Without an explicit time zone, a date formatted in a Server Component uses the
    // *container's* zone (UTC here) while the same date formatted in the browser uses the user's
    // -- so the server HTML and the client render disagree, which is a hydration mismatch and, on
    // a deadline, a wrong answer rather than a cosmetic one.
    //
    // Pinning it to the deployment's zone rather than trying to detect the user's is also the more
    // correct behaviour for this product, not just the more convenient one: a deadline announced
    // as 23:59 is 23:59 in the course's own time zone, and everyone discussing it -- student,
    // supervisor, the assignment text itself -- means that same wall-clock time. Showing a student
    // abroad "22:59" would be technically accurate and practically confusing. Overridable per
    // deployment via APP_TIME_ZONE.
    timeZone: process.env.APP_TIME_ZONE || "Europe/Prague",
  };
});
