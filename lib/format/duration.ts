/**
 * Durations as `h:mm`, the format the legacy exam form uses for "how long the exam lasts"
 * (`ExamForm`'s `secondsToTime`/`timeToSeconds`, S-008). Kept as its own helper rather than
 * inlined in the form because the round trip has to be exact: a length typed as `1:30` and one
 * derived back from a stored period must agree, or editing an exam would silently move its end.
 */
export function secondsToHoursMinutes(seconds: number): string {
  if (seconds < 0) return "";
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes - hours * 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

/** Null for anything that is not `h:mm` -- the caller turns that into a field error. */
export function hoursMinutesToSeconds(value: string): number | null {
  const match = /^(\d+):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 3600 + minutes * 60;
}
