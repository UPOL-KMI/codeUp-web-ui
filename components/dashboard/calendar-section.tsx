import { getLocale, getTimeZone } from "next-intl/server";

import { getDeadlineCalendar, todayIn } from "@/lib/api/dashboard";
import {
  formatMonthParam,
  monthGrid,
  parseMonthParam,
  shiftMonth,
} from "@/lib/format/calendar-month";

import { DeadlineCalendar } from "./deadline-calendar";

/**
 * The dashboard's calendar half (S-003). Fetches its own data behind the page's `Suspense` and
 * `ErrorBoundary`, like the other two.
 *
 * The displayed month lives in the URL (`?month=YYYY-MM`), so a particular month is shareable and
 * survives a reload -- brief §9's "sharing a URL reproduces the exact view" -- and, more usefully
 * here, month navigation needs no client JavaScript at all: previous and next are ordinary links
 * to the same server-rendered page.
 *
 * The time zone comes from `getTimeZone()` rather than being read from the environment again, so
 * the zone the days are *bucketed* in is by construction the zone they are *formatted* in. Those
 * drifting apart is how a deadline ends up drawn on the wrong square.
 */
export async function CalendarSection({ monthParam }: { monthParam?: string }) {
  const [locale, timeZone] = await Promise.all([getLocale(), getTimeZone()]);
  const today = todayIn(timeZone);
  const month = parseMonthParam(monthParam, today);
  const { weeks, first, last } = monthGrid(month);
  const deadlinesByDay = await getDeadlineCalendar(locale, timeZone, { first, last });

  const monthHref = (delta: number) =>
    `/dashboard?tab=calendar&month=${formatMonthParam(shiftMonth(month, delta))}#dashboard-calendar`;

  return (
    <DeadlineCalendar
      month={month}
      weeks={weeks}
      deadlinesByDay={deadlinesByDay}
      today={today}
      prevHref={monthHref(-1)}
      nextHref={monthHref(1)}
    />
  );
}
