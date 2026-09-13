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

/**
 * Where a reason is answered, for the reasons that have one screen each.
 *
 * The list used to name what was missing and leave the reader to find the form themselves -- three
 * screens hang off an exercise and none of them is called "languages". `null` for the reasons that
 * are answered in more than one place, or by writing something rather than by opening a form.
 */
export function validationErrorHref(error: string, exerciseId: string): string | null {
  const key = /^@([\w-]+)/.exec(error)?.[1];
  switch (key) {
    // The configuration screen is three tabs (T-033's shape, added when it grew too long to read
    // as one column), and a link that lands on the wrong one is barely better than no link -- the
    // form it promised is behind a tab the reader has to guess. So each reason names its tab.
    case "no-runtimes":
    case "runtimes":
      return `/exercises/${exerciseId}/edit-config?tab=languages`;
    case "no-tests":
    case "no-configs":
    case "config":
      return `/exercises/${exerciseId}/edit-config?tab=tests`;
    case "no-hwgroups":
    case "limits":
      return `/exercises/${exerciseId}/edit-limits`;
    case "score":
      // The score lives with the tests it is computed from, not on a screen of its own.
      return `/exercises/${exerciseId}/edit-config?tab=tests`;
    default:
      return null;
  }
}

/**
 * The id of the environment that takes any file and runs no student code.
 *
 * An exercise whose only environment is this one is a **data-only exercise**: a teacher collecting
 * essays or measurements rather than programs. core-api makes no special case for it -- the same
 * validation demands at least one test, because a test is the unit its judge runs in -- but the
 * screens can, and do (DEC-141).
 */
export const DATA_ONLY_ENVIRONMENT = "data-linux";

export function isDataOnly(environmentIds: readonly string[]): boolean {
  return environmentIds.length > 0 && environmentIds.every((id) => id === DATA_ONLY_ENVIRONMENT);
}

/**
 * The name of the single test a data-only exercise gets written for it.
 *
 * ASCII on purpose: core-api's test names are `[-a-zA-Z0-9_()[].! ]`, so a translated name with
 * Czech diacritics is refused outright. The teacher can rename it; what matters is that it exists.
 */
export const DATA_ONLY_TEST_NAME = "Data";

/**
 * The judge a data-only exercise is given so that it works at all (DEC-141).
 *
 * **`data-linux` does not mean "do not evaluate".** Its pipeline runs no student code, but it does
 * run a judge -- the teacher's own, through `recodex-data-only-wrapper.sh` -- and with none chosen
 * the wrapper tries to execute the sandbox directory and every submission fails
 * (`/box/: Is a directory`, measured on this deployment). There is no built-in judge to fall back
 * on: the pipeline declares no expected output, only a custom judge.
 *
 * So an exercise that collects documents is given this one: it accepts whatever arrived and scores
 * it **zero**, which is what "nothing has been judged yet" means to the machine.
 *
 * **Zero rather than one, and that is the whole point.** core-api turns a score into points --
 * `floor(score * maxPoints)` -- so a judge that returned 1.0 handed every student full marks the
 * moment they uploaded a file, before any teacher looked at it. Reported by the operator, who
 * called it what it is. With zero, the submission is collected, the run succeeds, and the points
 * stay at nought until a teacher awards them by hand; the screens then say "waiting to be marked"
 * rather than showing a score nobody stands behind.
 *
 * It is an ordinary attached file and can be replaced by a judge that actually checks something.
 */
export const DATA_ONLY_JUDGE_NAME = "hodnoceni-rucne.sh";

export const DATA_ONLY_JUDGE_SOURCE = `#!/bin/sh
# Prijme cokoliv, co student odevzdal, a necha hodnoceni na vyucujicim.
# Prvni radek vystupu je uspesnost (0.0 az 1.0), navratovy kod 0 znamena "beh probehl v poradku".
# Nula je zamerne: body udeluje vyucujici rucne, stroj zadne pridelit nesmi.
echo 0.0
exit 0
`;

/**
 * Whether a file is this app's own data-only judge, in any version it has shipped.
 *
 * The first one scored 1.0 -- which core-api turned into full marks the moment a student uploaded
 * anything, before a teacher had seen it. Exercises created while that shipped still carry it, so
 * saving their languages replaces it. Recognised by what it is rather than by an exact match, so
 * that trailing whitespace or a changed comment does not make it unrecognisable, and **never** a
 * file a teacher wrote: it has to be our name, our shape and our own comment.
 */
export function isGeneratedDataOnlyJudge(source: string): boolean {
  return (
    source.includes("necha hodnoceni na vyucujicim") &&
    (source.includes("echo 1.0") || source.includes("echo 0.0"))
  );
}

/** True for the version that awarded full marks by itself, which must be replaced. */
export function isOutdatedDataOnlyJudge(source: string): boolean {
  return isGeneratedDataOnlyJudge(source) && source.includes("echo 1.0");
}
