import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/api/current-user";
import { readSessionToken } from "@/lib/auth/session-cookie";
import { dateFormatValue } from "@/lib/api/ui-preferences";

/**
 * Which language's conventions absolute dates follow for this request (G-022).
 *
 * **Why this exists rather than a prop.** `DateTime` is rendered from twenty-nine files, so
 * threading a preference down to it was never an option; and it renders on pages with no session
 * as well as pages with one. So it is resolved here, once per request, and read where it is
 * needed -- the same shape as every other request-scoped read in this app.
 *
 * **`readSessionToken()` first, deliberately.** `getCurrentUser()` goes through `requireSession()`,
 * which *redirects* when there is no session -- correct for a page that needs one, catastrophic
 * for a date on a public page. Asking for the cookie first is what keeps this callable from
 * anywhere.
 *
 * **It costs no request of its own.** `getCurrentUser()` is `cache()`-memoized per render and the
 * app shell has already called it on every page under `(app)`, which is every page that renders a
 * date. On the rare authenticated page that had not, this is that page's one call rather than a
 * second one.
 *
 * Returns null for "follow the interface language", which is what almost every account gets:
 * unset, unrecognised and absent all mean the same thing, and next-intl then uses the request
 * locale as it always did.
 */
export const dateFormatLocale = cache(async function dateFormatLocale(): Promise<string | null> {
  if (!(await readSessionToken())) return null;

  try {
    const user = await getCurrentUser();
    const override = dateFormatValue(user.dateFormatOverride);
    return override === "" ? null : override;
  } catch {
    // A dead session, or core-api refusing: a date is not the thing to fail a page over, and the
    // page's own reads will answer for the session properly a moment later.
    return null;
  }
});
