/**
 * core-api's reasons an exercise cannot be assigned, turned into sentences.
 *
 * They arrive as one string of `@key some English sentence` lines on the exercise's
 * `validationError` (T-021 splits them apart). The keys are a closed set the legacy app translates
 * one by one; this does the same, and falls back to core-api's own words for a key nobody has a
 * sentence for yet -- which is better than dropping a reason.
 *
 * Shared by the exercise screen, which reports them, and the configuration editor (T-009), which
 * is where most of them are answered.
 */
const KNOWN = [
  "no-texts",
  "no-tests",
  "score",
  "no-runtimes",
  "runtimes",
  "no-configs",
  "no-hwgroups",
  "config",
  "limits",
];

export function describeValidationError(error: string, t: (key: string) => string): string {
  const match = /^@([\w-]+)\s*(.*)$/s.exec(error);
  if (!match) return error;
  const [, key, rest] = match;
  return KNOWN.includes(key!) ? t(`validation.${key}`) : (rest ?? error);
}
