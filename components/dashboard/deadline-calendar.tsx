import { getFormatter, getTranslations } from "next-intl/server";

import type { CalendarDeadline } from "@/lib/api/dashboard";
import type { CalendarMonth } from "@/lib/format/calendar-month";

import { Link } from "@/i18n/navigation";

/**
 * The month view of every deadline the reader has, in the groups they study in and the ones they
 * teach (`docs/IA.md` §2's `?tab=calendar`, "full calendar view"). A real `<table>`: a calendar is
 * tabular -- rows are weeks, columns are weekdays -- and marking it up as one gives a screen
 * reader the column headers for free, which a grid of `<div>`s does not.
 *
 * **"Today" is rendered on the server, and that is safe here** even though `DeadlineBadge`
 * insists on the opposite for its own state. The difference is what the two answer. The badge
 * answers "has this deadline passed", against the *reader's* current moment, and acts as a claim
 * they will act on -- so it is computed client-side and never guessed. This highlight answers
 * "which cell is today in the course's time zone", which this app pins deliberately
 * (`i18n/request.ts`), and nothing recomputes it in the browser -- so there is no second answer to
 * disagree with the first, and no hydration mismatch to have. It goes stale on a page left open
 * across midnight; a ring around the wrong square is a cosmetic cost, not a wrong answer about a
 * deadline.
 *
 * Two presentations, one dataset: the month grid from `sm` up, and a plain list of the days that
 * actually have deadlines below that. A 7-column month grid on a phone is either unreadably small
 * or horizontally scrolled, and neither is a calendar anyone reads. Only one is in the
 * accessibility tree at a time (`display: none` removes the other).
 */
export interface DeadlineCalendarProps {
  month: CalendarMonth;
  weeks: string[][];
  deadlinesByDay: Map<string, CalendarDeadline[]>;
  /** `YYYY-MM-DD` in the app's time zone. */
  today: string;
  prevHref: string;
  nextHref: string;
}

/** 1 January 2024 was a Monday -- a fixed week to read localized weekday names off. */
const WEEKDAY_SAMPLE = Array.from(
  { length: 7 },
  (_, index) => new Date(Date.UTC(2024, 0, 1 + index, 12)),
);

function dayNumber(day: string): number {
  return Number(day.slice(8, 10));
}

export async function DeadlineCalendar({
  month,
  weeks,
  deadlinesByDay,
  today,
  prevHref,
  nextHref,
}: DeadlineCalendarProps) {
  const [t, format] = await Promise.all([getTranslations("Dashboard.calendar"), getFormatter()]);

  // Noon UTC, so the month label cannot slip a day into the previous month in any plausible zone.
  const monthLabel = format.dateTime(new Date(Date.UTC(month.year, month.month - 1, 1, 12)), {
    year: "numeric",
    month: "long",
  });
  const weekdays = WEEKDAY_SAMPLE.map((date) => ({
    short: format.dateTime(date, { weekday: "short" }),
    long: format.dateTime(date, { weekday: "long" }),
  }));

  const daysWithDeadlines = weeks.flat().filter((day) => deadlinesByDay.has(day));

  const chip = (deadline: CalendarDeadline) => {
    const time = format.dateTime(new Date(deadline.at * 1000), { timeStyle: "short" });
    return (
      <li key={`${deadline.assignmentId}-${deadline.kind}`}>
        <Link
          href={`/assignments/${deadline.assignmentId}`}
          title={`${time} — ${deadline.assignmentName} — ${deadline.groupName}`}
          className={`block rounded px-1 py-0.5 text-xs hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            deadline.kind === "second"
              ? "bg-warning/15 text-warning"
              : "bg-accent text-accent-foreground"
          }`}
        >
          <span className="line-clamp-2">{deadline.assignmentName}</span>
          <span className="block text-[11px] tabular-nums opacity-70">{time}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">{monthLabel}</h3>
        <div className="flex items-center gap-2">
          <Link
            href={prevHref}
            aria-label={t("previousMonth")}
            className="rounded-md border border-input px-2 py-1 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            ←
          </Link>
          <Link
            href={nextHref}
            aria-label={t("nextMonth")}
            className="rounded-md border border-input px-2 py-1 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            →
          </Link>
        </div>
      </div>

      <table className="hidden w-full table-fixed border-collapse sm:table">
        <caption className="sr-only">{t("caption", { month: monthLabel })}</caption>
        <thead>
          <tr>
            {weekdays.map((weekday) => (
              <th
                key={weekday.long}
                scope="col"
                className="border border-border bg-muted/50 px-2 py-1 text-xs font-medium"
              >
                <abbr title={weekday.long} className="no-underline">
                  {weekday.short}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const deadlines = deadlinesByDay.get(day) ?? [];
                const inMonth = Number(day.slice(5, 7)) === month.month;
                const isToday = day === today;
                return (
                  <td
                    key={day}
                    // `height` on a table cell behaves as a minimum, so rows stay a uniform size when empty
                    // and still grow for a day with several deadlines.
                    className={`h-24 border border-border p-1 align-top ${
                      inMonth ? "" : "bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <div
                      className={`mb-1 text-xs ${
                        isToday
                          ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {dayNumber(day)}
                    </div>
                    {deadlines.length > 0 && (
                      <ul className="flex flex-col gap-0.5">{deadlines.map(chip)}</ul>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col gap-3 sm:hidden">
        {daysWithDeadlines.length === 0 && (
          <li className="text-sm text-muted-foreground">{t("emptyMonth")}</li>
        )}
        {daysWithDeadlines.map((day) => (
          <li key={day}>
            <h4
              className={`mb-1 text-sm font-medium ${day === today ? "text-primary" : "text-foreground"}`}
            >
              {format.dateTime(new Date(`${day}T12:00:00Z`), {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h4>
            <ul className="flex flex-col gap-1">{(deadlinesByDay.get(day) ?? []).map(chip)}</ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
