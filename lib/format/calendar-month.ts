/**
 * Month-grid arithmetic for the dashboard calendar (S-003), on plain `YYYY-MM-DD` day strings
 * rather than `Date` objects.
 *
 * The reason is the one thing a deadline calendar cannot get wrong: **which day a deadline falls
 * on depends on the time zone**, and this app pins one (`i18n/request.ts`, Europe/Prague by
 * default) rather than using the server's or the browser's. A `Date` carries an instant, not a
 * calendar day, so doing the arithmetic on `Date` objects means every operation has to remember
 * to convert -- and the first one that forgets moves a midnight deadline to the wrong day, in the
 * one place where being one day off is the whole point. A day string has no zone to get wrong:
 * the caller converts an instant to a day *once*, in the app's zone, and everything after that is
 * string and integer work.
 *
 * `Date.UTC` appears below only as a calendar calculator -- UTC because it is the one zone with no
 * DST, so "add one day" is always 24 hours and never silently repeats or skips an hour. These
 * instants are never formatted for a reader.
 *
 * Weeks start on Monday in both locales. `Intl.Locale.prototype.getWeekInfo()` would answer this
 * per locale, but it does not exist in the Node this runs on (checked: 22.22.3, `not a function`),
 * and Monday is right for `cs` and for the `en` used by a Czech university -- the alternative is a
 * hardcoded table pretending to be locale-awareness.
 */
export interface CalendarMonth {
  year: number;
  /** 1-12, as a person writes it, not 0-11. */
  month: number;
}

const DAY_MS = 86_400_000;
const MONTH_PARAM = /^(\d{4})-(\d{2})$/;

function toDayString(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

function startOfMonthMs({ year, month }: CalendarMonth): number {
  return Date.UTC(year, month - 1, 1);
}

/** `"2026-08-22"` -> the Monday-based column index of that day, 0-6. */
export function weekdayIndex(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function formatMonthParam({ year, month }: CalendarMonth): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function monthOf(day: string): CalendarMonth {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) };
}

export function shiftMonth({ year, month }: CalendarMonth, delta: number): CalendarMonth {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

/**
 * A `?month=` value, falling back to the month containing `today` for anything unparseable --
 * deliberately not a 404. A malformed month in a shared URL should still show the reader a
 * calendar, and there is no such thing as a month that does not exist.
 */
export function parseMonthParam(value: string | undefined, today: string): CalendarMonth {
  const match = value?.match(MONTH_PARAM);
  if (!match) return monthOf(today);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 1970 || year > 9999) return monthOf(today);
  return { year, month };
}

/**
 * The weeks a month is drawn as: whole Monday-to-Sunday rows covering it, so the leading and
 * trailing cells belong to the neighbouring months. Callers fetch deadlines for the whole range
 * (`first`/`last` below) rather than for the month, so a deadline shown in a trailing cell is a
 * real one rather than a blank.
 */
export function monthGrid(month: CalendarMonth): {
  weeks: string[][];
  first: string;
  last: string;
} {
  const firstOfMonth = startOfMonthMs(month);
  const gridStart = firstOfMonth - weekdayIndex(toDayString(firstOfMonth)) * DAY_MS;

  const lastOfMonth = startOfMonthMs(shiftMonth(month, 1)) - DAY_MS;
  const gridEnd = lastOfMonth + (6 - weekdayIndex(toDayString(lastOfMonth))) * DAY_MS;

  const weeks: string[][] = [];
  for (let cursor = gridStart; cursor <= gridEnd; cursor += 7 * DAY_MS) {
    weeks.push(Array.from({ length: 7 }, (_, index) => toDayString(cursor + index * DAY_MS)));
  }

  return { weeks, first: toDayString(gridStart), last: toDayString(gridEnd) };
}
