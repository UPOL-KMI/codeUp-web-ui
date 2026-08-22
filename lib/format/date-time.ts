/**
 * The one set of date/time formatting options (D-012: "One date format... shared helpers").
 *
 * They live here, apart from the `DateTime` Server Component that was D-012's original home,
 * because S-006 needs the same formatting inside a `DataTable` cell -- which runs in the browser,
 * where a Server Component cannot go. Sharing the options object rather than duplicating
 * `{ dateStyle, timeStyle }` at each call site is what keeps "one date format" true across that
 * boundary: both sides pass the same object to the same `next-intl` formatter, configured with the
 * same pinned time zone.
 */
export const DATE_TIME_FORMAT = { dateStyle: "medium", timeStyle: "short" } as const;

/** Date only -- for deadlines-by-day, list columns, anywhere the clock time is noise. */
export const DATE_ONLY_FORMAT = { dateStyle: "medium" } as const;

/** With seconds. Submission timestamps need them; almost nothing else does. */
export const DATE_TIME_SECONDS_FORMAT = { dateStyle: "medium", timeStyle: "medium" } as const;
