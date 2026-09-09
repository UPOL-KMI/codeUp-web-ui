/**
 * What a test's exit code means, where the runtime environment gives it one (G-004).
 *
 * A program that crashed exits with a code, and for four of ReCodEx's environments that code is
 * not the operating system's -- it is produced by the wrapper the environment runs the solution
 * under, which turns an uncaught exception into a number. `110` from a Python solution is a
 * division by zero, not "the process chose to return 110", and a student told only "Failed" has to
 * guess at that. These are the legacy frontend's own tables
 * (`repos/web-app/src/components/helpers/exitCodeMapping.js`), carried across with its
 * translations; the names themselves live in `messages/*.json` like every other string.
 *
 * Only the **codes** are here. A code this table does not know is rendered as the number it is,
 * which is also what the legacy app does -- an environment can grow a code faster than a frontend
 * learns its name, and a number is never wrong.
 *
 * Not to be confused with `lib/exercise-config/exit-codes.ts`, which is the other half of the same
 * subject: which codes an *exercise* chooses to treat as a success.
 */
const KNOWN_EXIT_CODES: Readonly<Record<string, readonly number[]>> = {
  "freepascal-linux": [
    1, 2, 3, 4, 5, 6, 12, 15, 16, 17, 100, 101, 102, 103, 104, 105, 106, 150, 151, 152, 154, 156,
    157, 158, 159, 160, 161, 162, 200, 201, 202, 203, 204, 205, 206, 207, 210, 211, 212, 213, 214,
    215, 216, 217, 218, 219, 222, 223, 224, 225, 227, 229, 231, 232,
  ],
  python3: [1, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115],
  java: [1, 2, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113],
  "cs-dotnet-core": [1, 101, 102, 103, 104, 105, 106, 107, 108, 109, 200, 201, 202],
};

/** core-api's "no exit code was observed", not a code a program can return. */
export const EXIT_CODE_UNKNOWN = -1;

/**
 * The message key naming this code, relative to the `Solution.evaluation` namespace, or `null`
 * where there is no name to give it.
 */
export function exitCodeMessageKey(environment: string, exitCode: number): string | null {
  if (exitCode === EXIT_CODE_UNKNOWN) return "exit.unknown";
  return KNOWN_EXIT_CODES[environment]?.includes(exitCode)
    ? `exit.codes.${environment}.${exitCode}`
    : null;
}

/** The environments this table covers, for the test that checks every code has both translations. */
export const ENVIRONMENTS_WITH_EXIT_CODE_NAMES = Object.entries(KNOWN_EXIT_CODES);
