import { describe, expect, it } from "vitest";

import { testsSchema } from "./exercise-config.schema";

const test = (name: string, weight: number) => ({ id: null, name, weight });

describe("testsSchema", () => {
  /**
   * **Zero weights are allowed, deliberately.** A teacher may want the tests to run and report
   * while awarding the points by hand -- weights of nought are how that is expressed, and the
   * operator asked for it after a refusal had been added. The confusion it caused (a passing test
   * beside a 0 % verdict) is answered by the note the form shows, not by refusing the save.
   */
  it("accepts a weighted configuration in which nothing counts", () => {
    expect(testsSchema.safeParse({ calculator: "weighted", tests: [test("a", 0)] }).success).toBe(
      true,
    );
  });

  it("allows clearing every test, which is how a configuration is started over", () => {
    expect(testsSchema.safeParse({ calculator: "weighted", tests: [] }).success).toBe(true);
  });

  it("catches two tests sharing a name", () => {
    const result = testsSchema.safeParse({
      calculator: "weighted",
      tests: [test("a", 100), test("a", 100)],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain("duplicate");
  });

  it("refuses a negative weight, which the calculator has no meaning for", () => {
    expect(testsSchema.safeParse({ calculator: "weighted", tests: [test("a", -1)] }).success).toBe(
      false,
    );
  });
});
