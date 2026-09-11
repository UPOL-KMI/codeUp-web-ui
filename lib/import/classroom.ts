/**
 * Reading a GitHub Classroom assignment's `autograding.json` into something ReCodEx can hold
 * (X-001).
 *
 * **Pure, and separate from anything that writes.** The screen that imports calls this first and
 * shows what came back *before* creating anything, because the interesting output is not the tests
 * -- it is the list of things that could not be carried over. A wizard that appears to succeed and
 * produces an exercise which grades nothing is worse than no importer.
 *
 * What maps: a Classroom test with `input`/`output` and a byte-exact comparison **is** a ReCodEx
 * test with the `diff` judge, which is the shape the seeded `[seed] Echo Greeting` exercise has.
 * For an intro programming course, which is most of the population this is for, that is the bulk
 * of an assignment.
 *
 * What does not, and is reported rather than dropped quietly:
 *
 * - `comparison: "regex"` has no ReCodEx judge at all.
 * - `comparison: "included"` -- "the expected text appears somewhere in the output" -- has none
 *   either. `recodex-judge-normal` compares token by token ignoring whitespace, which accepts
 *   *more* than byte-exact and *less* than containment, so it is offered as an approximation with
 *   that said out loud rather than chosen silently.
 * - A test whose `run` invokes a test framework cannot become stdin/stdout pairs. It could become
 *   **one** test judged on the exit code, which collapses twenty cases into one pass/fail, so this
 *   reports it and leaves the choice to the author.
 * - `setup` is an arbitrary shell line with nowhere to run: ReCodEx's pipelines are declarative.
 *   A test that needs one can still map, but only if the runtime already provides what the setup
 *   installed, which only the author knows.
 *
 * Nothing here creates an exercise, and **no import can produce an assignable one**: core-api
 * refuses to let an exercise be assigned without a reference solution (T-011) and Classroom
 * templates rarely carry a solution, so the result always says so.
 */

/** The judges this importer picks between. Both are in the list `test-config-form.tsx` carries. */
const EXACT_JUDGE = "diff";
const TOKEN_JUDGE = "recodex-judge-normal";

/**
 * `timeout` in `autograding.json` is **minutes**; a ReCodEx wall-time limit is seconds.
 *
 * Recorded as an assumption rather than a fact (DEC-135): it is what GitHub's own autograding
 * documentation says, and this importer has not been run against a real exported file yet. If it is
 * wrong the effect is a limit 60x too generous, which fails no submission and shows up the first
 * time an author looks at the limits screen -- the safe direction to be wrong in.
 */
const SECONDS_PER_CLASSROOM_TIMEOUT_UNIT = 60;

/** Wall-time actually accepted by the limits screen, so an absurd `timeout` cannot produce one. */
const MAX_WALL_TIME_SECONDS = 60;

/**
 * How the `run` command is read to guess an environment. First match wins, so **C++ is tested
 * before C**: a build line may name both (`make CC=gcc CXX=g++`) and the more specific one is the
 * better guess. No trailing `\b` after `++` -- a word boundary needs a word character on one side,
 * and `g++ ` has none, which is why an earlier version of this guessed nothing for every C++
 * exercise.
 */
const ENVIRONMENT_HINTS: { pattern: RegExp; environment: string }[] = [
  { pattern: /\bpython3?\b/, environment: "python3" },
  { pattern: /\bg\+\+|\bclang\+\+/, environment: "cxx-gcc-linux" },
  { pattern: /\b(gcc|cc)\b/, environment: "c-gcc-linux" },
  { pattern: /\b(bash|sh)\b/, environment: "bash" },
];

/** A `run` that means "a framework decides pass or fail", which no stdin/stdout pair can express. */
const FRAMEWORK_HINTS = /\b(pytest|unittest|nose2?|mvn|gradle|junit|jest|mocha|vitest|ctest)\b/;

/**
 * What core-api accepts as a test name, restated from `exercise-config.schema.ts`.
 *
 * **A Classroom test name is free text and this is not**, so a name has to be rewritten rather
 * than passed through -- and the rewrite is reported, because a test the author cannot find by the
 * name they gave it is a test they will not trust.
 */
const TEST_NAME_ALLOWED = /^[-a-zA-Z0-9_()[\].! ]+$/;
const TEST_NAME_MAX = 64;

/** The score weight core-api accepts: a whole number, 0 to 10000. Classroom's `points` need not be
 *  either, and a weight of 0 would silence the test rather than score it low. */
const MAX_WEIGHT = 10000;

function toTestName(raw: string, index: number): { name: string; renamed: boolean } {
  const folded = raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^-a-zA-Z0-9_()[\].! ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TEST_NAME_MAX)
    .trim();
  const name = TEST_NAME_ALLOWED.test(folded) ? folded : "";
  if (name === "") return { name: `Test ${index + 1}`, renamed: true };
  return { name, renamed: name !== raw.trim() };
}

export interface ClassroomTest {
  name?: unknown;
  setup?: unknown;
  run?: unknown;
  input?: unknown;
  output?: unknown;
  comparison?: unknown;
  timeout?: unknown;
  points?: unknown;
}

/** One ReCodEx test an import would create. `stdin`/`expectedOutput` are *contents*, not names:
 *  core-api's configuration references supplementary files, so the caller uploads these first. */
export interface ImportedTest {
  name: string;
  stdin: string;
  expectedOutput: string;
  judgeType: string;
  /** The test's share of the score, from Classroom's `points`. `1` when it declared none. */
  weight: number;
  /** Seconds, or `null` when the Classroom test set no timeout. */
  wallTimeSeconds: number | null;
}

export type ImportNoteKind =
  | "regex-comparison"
  | "containment-comparison"
  | "framework-run"
  | "no-input-or-output"
  | "setup-command"
  | "timeout-clamped"
  | "duplicate-name"
  | "unnamed-test"
  | "renamed-test"
  | "rounded-points";

export interface ImportNote {
  /** The Classroom test this is about, by name, or its position when it had none. */
  test: string;
  /** `dropped`: nothing was created for it. `approximated`: a test was created but differs. */
  severity: "dropped" | "approximated";
  kind: ImportNoteKind;
}

export interface ClassroomImport {
  tests: ImportedTest[];
  notes: ImportNote[];
  /** Guessed from the `run` commands; `null` when they say nothing recognisable. */
  environment: string | null;
  /** How many tests the file declared, mapped or not. */
  declared: number;
}

export class ClassroomParseError extends Error {}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Reads the text of an `autograding.json`.
 *
 * Throws `ClassroomParseError` for a file that is not one -- unparseable, or parseable with no
 * `tests` array. Everything else is a note rather than a failure: a file with ten tests of which
 * two cannot map should import eight, not nothing.
 */
export function parseAutograding(text: string): ClassroomImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ClassroomParseError("not JSON");
  }
  if (typeof parsed !== "object" || parsed === null) throw new ClassroomParseError("not an object");
  const declaredTests = (parsed as { tests?: unknown }).tests;
  if (!Array.isArray(declaredTests)) throw new ClassroomParseError("no tests array");

  const tests: ImportedTest[] = [];
  const notes: ImportNote[] = [];
  const used = new Set<string>();
  let environment: string | null = null;

  declaredTests.forEach((raw, index) => {
    const test: ClassroomTest = typeof raw === "object" && raw !== null ? raw : {};
    const declaredName = asString(test.name).trim();
    const label = declaredName || `#${index + 1}`;
    if (!declaredName) notes.push({ test: label, severity: "approximated", kind: "unnamed-test" });

    const run = asString(test.run);
    if (environment === null) {
      environment = ENVIRONMENT_HINTS.find((hint) => hint.pattern.test(run))?.environment ?? null;
    }

    // A framework run is reported and nothing is created for it: the alternative -- one exit-code
    // test standing in for the whole suite -- is a decision only the author can make.
    if (FRAMEWORK_HINTS.test(run)) {
      notes.push({ test: label, severity: "dropped", kind: "framework-run" });
      return;
    }

    const comparison = asString(test.comparison).trim().toLowerCase();
    if (comparison === "regex") {
      notes.push({ test: label, severity: "dropped", kind: "regex-comparison" });
      return;
    }

    const input = asString(test.input);
    const output = asString(test.output);
    // Both empty means this test says nothing about stdin and stdout, so there is no pair to carry.
    // An empty *input* alone is ordinary -- a program that reads nothing still prints something.
    if (input === "" && output === "") {
      notes.push({ test: label, severity: "dropped", kind: "no-input-or-output" });
      return;
    }

    let judgeType = EXACT_JUDGE;
    if (comparison === "included") {
      judgeType = TOKEN_JUDGE;
      notes.push({ test: label, severity: "approximated", kind: "containment-comparison" });
    }

    if (asString(test.setup).trim() !== "") {
      notes.push({ test: label, severity: "approximated", kind: "setup-command" });
    }

    // A name has to be unique for the score configuration, which is keyed by it -- and legal for
    // core-api, which is a narrower alphabet than a Classroom name is written in.
    const rewritten = toTestName(declaredName, index);
    if (rewritten.renamed && declaredName !== "") {
      notes.push({ test: label, severity: "approximated", kind: "renamed-test" });
    }
    let name = rewritten.name;
    if (used.has(name)) {
      notes.push({ test: label, severity: "approximated", kind: "duplicate-name" });
      let suffix = 2;
      while (used.has(`${name} (${suffix})`)) suffix++;
      name = `${name} (${suffix})`;
    }
    used.add(name);

    let wallTimeSeconds: number | null = null;
    const timeout = typeof test.timeout === "number" ? test.timeout : Number(test.timeout);
    if (Number.isFinite(timeout) && timeout > 0) {
      const seconds = timeout * SECONDS_PER_CLASSROOM_TIMEOUT_UNIT;
      wallTimeSeconds = Math.min(seconds, MAX_WALL_TIME_SECONDS);
      if (wallTimeSeconds !== seconds) {
        notes.push({ test: label, severity: "approximated", kind: "timeout-clamped" });
      }
    }

    const points = typeof test.points === "number" ? test.points : Number(test.points);
    let weight = 1;
    if (Number.isFinite(points) && points > 0) {
      weight = Math.min(Math.round(points), MAX_WEIGHT);
      // Rounding changes the arithmetic, which the write-up warned about: Classroom's totals and
      // ReCodEx's are not the same sum even before this. Said rather than absorbed.
      if (weight !== points) {
        notes.push({ test: label, severity: "approximated", kind: "rounded-points" });
      }
    }

    tests.push({
      name,
      stdin: input,
      expectedOutput: output,
      judgeType,
      weight,
      wallTimeSeconds,
    });
  });

  return { tests, notes, environment, declared: declaredTests.length };
}

/**
 * The file names an imported test's two halves get as supplementary files.
 *
 * Derived from the test's name so an author reading the files list can tell which test each belongs
 * to, and sanitised because a Classroom test name is free text while these become file names.
 *
 * **Diacritics are folded rather than dropped**, which matters on the deployment this is for:
 * stripping them turns `Ověř součet` into `ov-sou-et`, and folding turns it into `over-soucet`.
 * `NFD` splits a letter from its accent so the accent alone can be removed, leaving the letter.
 */
export function importedTestFileNames(
  name: string,
  index: number,
): { stdin: string; expectedOutput: string } {
  const slug =
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || `test-${index + 1}`;
  return { stdin: `${slug}.in`, expectedOutput: `${slug}.out` };
}
