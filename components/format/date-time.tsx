import { getFormatter } from "next-intl/server";

import {
  DATE_ONLY_FORMAT,
  DATE_TIME_FORMAT,
  DATE_TIME_SECONDS_FORMAT,
} from "@/lib/format/date-time";
import { dateFormatLocale } from "@/lib/format/date-locale";

/**
 * The one absolute date/time rendering (D-012). Brief §9: "One date format... shared helpers."
 *
 * A Server Component, and safe to be one *because* `i18n/request.ts` pins an explicit `timeZone`
 * -- without that, this would format in the container's zone while anything client-side formatted
 * in the user's, which is the hydration mismatch AGENTS.md §6.6 warns about and, on a deadline, a
 * wrong answer rather than a cosmetic one.
 *
 * Takes unix **seconds**, the unit core-api returns (`firstDeadline`, `uploadedAt`, `startedAt`
 * are all seconds; passing milliseconds by mistake yields a date in the year 56000, which is at
 * least loud). Emits a `<time datetime="...">` so the machine-readable ISO value travels with the
 * human-readable one -- useful for the browser, and for anything scraping the page.
 */
export interface DateTimeProps {
  unixSeconds: number;
  /** Date only -- for deadlines-by-day, list columns, anywhere the clock time is noise. */
  dateOnly?: boolean;
  /** Adds seconds. Submission timestamps need them; almost nothing else does. */
  withSeconds?: boolean;
}

export async function DateTime({ unixSeconds, dateOnly, withSeconds }: DateTimeProps) {
  // G-022: a reader may ask for one language's date conventions while reading the interface in the
  // other. `getFormatter` still receives the request config -- including `i18n/request.ts`'s pinned
  // `timeZone`, which is what keeps the instant right -- and only the locale is overridden.
  const locale = await dateFormatLocale();
  const format = await getFormatter(locale === null ? undefined : { locale });
  const date = new Date(unixSeconds * 1000);

  const formatted = format.dateTime(
    date,
    dateOnly ? DATE_ONLY_FORMAT : withSeconds ? DATE_TIME_SECONDS_FORMAT : DATE_TIME_FORMAT,
  );

  return (
    <time dateTime={date.toISOString()} className="whitespace-nowrap">
      {formatted}
    </time>
  );
}
