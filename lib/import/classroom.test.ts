import { describe, expect, it } from "vitest";

import { ClassroomParseError, importedTestFileNames, parseAutograding } from "./classroom";

/**
 * X-001's parser. Written against the shape GitHub Classroom's `autograding.json` actually has,
 * and mostly about what it *reports* rather than what it maps -- the mapping is a rename, the
 * reporting is the part a reader has to be able to trust.
 */
const test = (over: Record<string, unknown> = {}) => ({
  name: "Test 1",
  setup: "",
  run: "python3 main.py",
  input: "5",
  output: "25",
  comparison: "exact",
  timeout: 1,
  points: 5,
  ...over,
});

const file = (tests: unknown[]) => JSON.stringify({ tests });

describe("parseAutograding", () => {
  it("refuses a file that is not an autograding.json rather than importing nothing", () => {
    expect(() => parseAutograding("not json")).toThrow(ClassroomParseError);
    expect(() => parseAutograding("[]")).toThrow(ClassroomParseError);
    expect(() => parseAutograding('{"name":"x"}')).toThrow(ClassroomParseError);
    // A file with no tests *is* one, and imports as an exercise with none.
    expect(parseAutograding('{"tests":[]}')).toMatchObject({ tests: [], declared: 0 });
  });

  it("maps a byte-exact stdin/stdout test onto the diff judge", () => {
    const result = parseAutograding(file([test()]));
    expect(result.notes).toEqual([]);
    expect(result.tests).toEqual([
      {
        name: "Test 1",
        stdin: "5",
        expectedOutput: "25",
        judgeType: "diff",
        weight: 5,
        wallTimeSeconds: 60,
      },
    ]);
  });

  it("guesses the environment from the run command, and says nothing when it cannot", () => {
    expect(parseAutograding(file([test({ run: "python3 main.py" })])).environment).toBe("python3");
    expect(parseAutograding(file([test({ run: "gcc -o a a.c && ./a" })])).environment).toBe(
      "c-gcc-linux",
    );
    expect(parseAutograding(file([test({ run: "g++ -o a a.cpp" })])).environment).toBe(
      "cxx-gcc-linux",
    );
    expect(parseAutograding(file([test({ run: "bash solve.sh" })])).environment).toBe("bash");
    expect(parseAutograding(file([test({ run: "./my-binary" })])).environment).toBeNull();
  });

  it("reports containment as an approximation rather than choosing it silently", () => {
    const result = parseAutograding(file([test({ comparison: "included" })]));
    // A test *is* created -- dropping it would lose a case the author can still use -- but the
    // judge is not the one Classroom asked for, and that is what the note says.
    expect(result.tests[0]!.judgeType).toBe("recodex-judge-normal");
    expect(result.notes).toEqual([
      { test: "Test 1", severity: "approximated", kind: "containment-comparison" },
    ]);
  });

  it("drops a regex comparison, which no judge here can do", () => {
    const result = parseAutograding(file([test({ comparison: "regex", output: "^\\d+$" })]));
    expect(result.tests).toEqual([]);
    expect(result.notes).toEqual([
      { test: "Test 1", severity: "dropped", kind: "regex-comparison" },
    ]);
  });

  it("drops a test a framework decides, rather than collapsing a suite into one pass/fail", () => {
    for (const run of ["pytest -q", "python -m unittest", "mvn test", "gradle test"]) {
      const result = parseAutograding(file([test({ run, input: "", output: "" })]));
      expect(result.tests, run).toEqual([]);
      expect(result.notes, run).toEqual([
        { test: "Test 1", severity: "dropped", kind: "framework-run" },
      ]);
    }
  });

  it("drops a test that declares neither input nor output, and keeps one with only output", () => {
    expect(parseAutograding(file([test({ input: "", output: "" })])).notes).toEqual([
      { test: "Test 1", severity: "dropped", kind: "no-input-or-output" },
    ]);
    // A program that reads nothing and prints something is an ordinary test, not a broken one.
    const printsOnly = parseAutograding(file([test({ input: "", output: "hello" })]));
    expect(printsOnly.notes).toEqual([]);
    expect(printsOnly.tests[0]).toMatchObject({ stdin: "", expectedOutput: "hello" });
  });

  it("keeps a test that needs a setup command, and says the setup is gone", () => {
    const result = parseAutograding(file([test({ setup: "pip install -r requirements.txt" })]));
    expect(result.tests).toHaveLength(1);
    expect(result.notes).toEqual([
      { test: "Test 1", severity: "approximated", kind: "setup-command" },
    ]);
  });

  it("converts the timeout into seconds and clamps one no limits screen would accept", () => {
    // Half a minute stays under the ceiling and converts exactly.
    expect(parseAutograding(file([test({ timeout: 0.5 })])).tests[0]!.wallTimeSeconds).toBe(30);
    const clamped = parseAutograding(file([test({ timeout: 10 })]));
    expect(clamped.tests[0]!.wallTimeSeconds).toBe(60);
    expect(clamped.notes).toEqual([
      { test: "Test 1", severity: "approximated", kind: "timeout-clamped" },
    ]);
    // No timeout at all is not a limit of zero.
    expect(
      parseAutograding(file([test({ timeout: undefined })])).tests[0]!.wallTimeSeconds,
    ).toBeNull();
  });

  it("defaults points to one, because a weight of zero would silence the test", () => {
    expect(parseAutograding(file([test({ points: undefined })])).tests[0]!.weight).toBe(1);
    expect(parseAutograding(file([test({ points: 0 })])).tests[0]!.weight).toBe(1);
    expect(parseAutograding(file([test({ points: "3" })])).tests[0]!.weight).toBe(3);
  });

  it("makes duplicate names unique, because the score configuration is keyed by name", () => {
    const result = parseAutograding(file([test(), test(), test()]));
    expect(result.tests.map((one) => one.name)).toEqual(["Test 1", "Test 1 (2)", "Test 1 (3)"]);
    expect(result.notes.filter((one) => one.kind === "duplicate-name")).toHaveLength(2);
  });

  it("rewrites a name core-api's alphabet would refuse, and says it did", () => {
    // core-api's test names are `[-a-zA-Z0-9_()[].! ]` and at most 64 characters; a Classroom name
    // is free text, so this is a rename rather than a pass-through.
    const result = parseAutograding(file([test({ name: "Ověř součet / 2 × 3" })]));
    expect(result.tests[0]!.name).toBe("Over soucet 2 3");
    expect(result.notes).toEqual([
      { test: "Ověř součet / 2 × 3", severity: "approximated", kind: "renamed-test" },
    ]);
    // A name that is legal already is left exactly as it was, and reported as nothing.
    expect(parseAutograding(file([test({ name: "Case (1).x!" })])).notes).toEqual([]);
    // 64 characters is the ceiling.
    expect(parseAutograding(file([test({ name: "c".repeat(80) })])).tests[0]!.name).toHaveLength(
      64,
    );
    // Nothing legal left means a positional name rather than an empty one core-api would refuse.
    expect(parseAutograding(file([test({ name: "×××" })])).tests[0]!.name).toBe("Test 1");
  });

  it("rounds points to the whole number a weight has to be, and says so", () => {
    const result = parseAutograding(file([test({ points: 2.5 })]));
    expect(result.tests[0]!.weight).toBe(3);
    expect(result.notes).toEqual([
      { test: "Test 1", severity: "approximated", kind: "rounded-points" },
    ]);
    // A whole number needs no note, and an absurd one is capped rather than refused.
    expect(parseAutograding(file([test({ points: 4 })])).notes).toEqual([]);
    expect(parseAutograding(file([test({ points: 999999 })])).tests[0]!.weight).toBe(10000);
  });

  it("names an unnamed test by its position and says it did", () => {
    const result = parseAutograding(file([test({ name: "" })]));
    expect(result.tests[0]!.name).toBe("Test 1");
    expect(result.notes).toEqual([{ test: "#1", severity: "approximated", kind: "unnamed-test" }]);
  });

  it("survives a tests array with entries that are not objects", () => {
    const result = parseAutograding(file([null, 7, "x", test()]));
    expect(result.declared).toBe(4);
    expect(result.tests).toHaveLength(1);
    expect(result.notes.filter((one) => one.severity === "dropped")).toHaveLength(3);
  });

  it("imports the eight that map from a file where two do not", () => {
    const tests = [
      ...Array.from({ length: 8 }, (_, index) => test({ name: `Case ${index + 1}` })),
      test({ name: "Regex", comparison: "regex" }),
      test({ name: "Suite", run: "pytest" }),
    ];
    const result = parseAutograding(file(tests));
    expect(result.declared).toBe(10);
    expect(result.tests).toHaveLength(8);
    expect(result.notes.map((one) => one.kind).sort()).toEqual([
      "framework-run",
      "regex-comparison",
    ]);
  });
});

describe("importedTestFileNames", () => {
  it("derives a file name an author can match to its test", () => {
    expect(importedTestFileNames("Case 1", 0)).toEqual({
      stdin: "case-1.in",
      expectedOutput: "case-1.out",
    });
  });

  it("sanitises a name that is free text, since these become file names", () => {
    // Folded, not dropped: `ov-sou-et` would be unreadable, and this deployment is a Czech one.
    expect(importedTestFileNames("Ověř součet / 2 × 3!", 0).stdin).toBe("over-soucet-2-3.in");
    expect(importedTestFileNames("...", 4).stdin).toBe("test-5.in");
    expect(importedTestFileNames("x".repeat(80), 0).stdin).toBe(`${"x".repeat(40)}.in`);
  });
});
