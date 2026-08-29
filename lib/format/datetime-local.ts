/**
 * The two conversions an `<input type="datetime-local">` needs (S-008).
 *
 * The input speaks wall-clock time in the **browser's** zone with no offset (`YYYY-MM-DDTHH:mm`),
 * while core-api speaks unix seconds. Both conversions therefore have to happen in the browser --
 * `i18n/request.ts` pins a display time zone for formatting (D-012), but a value the reader typed
 * into a picker is in the zone their clock is in, and reinterpreting it in another would move an
 * exam by hours.
 */
export function toDateTimeLocal(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Null for an empty or unparseable value, which is what an unfilled picker submits. */
export function fromDateTimeLocal(value: string): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}
