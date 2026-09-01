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
