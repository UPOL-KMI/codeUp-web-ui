/**
 * File sizes, in one place (D-012's rule for points and dates, applied to the third number this
 * app renders in more than one screen). Extracted from `components/upload/file-upload.tsx` when
 * T-021's attachment list needed the same formatting -- two copies of a rounding rule is how two
 * screens end up disagreeing about how big the same file is.
 *
 * Binary units, because that is what every limit in this system is expressed in: core-api's
 * `solutionSizeLimit` is bytes, and the deployment's own ceiling is `512M` in nginx and PHP, which
 * both mean MiB.
 *
 * **Deliberately locale-independent.** This renders in client components and in server-rendered
 * ones, and a locale-formatted number would be exactly the hydration mismatch AGENTS.md §6.6 warns
 * about: one decimal place, ASCII separator, identical everywhere.
 */
export function formatBytes(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${rounded} ${units[unit]}`;
}

/**
 * A memory limit, as typed into the exercise's limits table, rendered as a size.
 *
 * **core-api's unit here is kilobytes** -- `Limits::getMemoryLimit()` says so in as many words,
 * and isolate's own `--mem` is the same -- but the field carries no unit, so "1024" read as bytes,
 * as megabytes, or as whatever the reader assumed. This is the hint beside it.
 *
 * Takes the raw field value rather than a number: it follows what is being typed, and half-typed
 * or empty is not an error to report but a moment with nothing to say.
 */
export function kilobytesAsSize(kilobytes: string | number | null | undefined): string {
  if (kilobytes === null || kilobytes === undefined || kilobytes === "") return "";
  const value = Number(kilobytes);
  if (!Number.isFinite(value) || value < 0) return "";
  return formatBytes(value * 1024);
}
