import { describe, expect, it } from "vitest";

import { testsSchemaChecked } from "./exercise-config.schema";

const test = (name: string, weight: number) => ({ id: null, name, weight });

describe("testsSchemaChecked", () => {
  it("refuses a weighted configuration in which nothing counts", () => {
    const result = testsSchemaChecked.safeParse({
      calculator: "weighted",
      tests: [test("Scitani a odcitani", 0)],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain("allWeightsZero");
  });

  it("accepts a weighted configuration where one test carries the weight", () => {
    expect(
      testsSchemaChecked.safeParse({
        calculator: "weighted",
        tests: [test("a", 0), test("b", 100)],
      }).success,
    ).toBe(true);
  });

  it("says nothing about zero weights under uniform scoring, which ignores them", () => {
    expect(
      testsSchemaChecked.safeParse({ calculator: "uniform", tests: [test("a", 0)] }).success,
    ).toBe(true);
  });

  it("still allows clearing every test, which is how a configuration is started over", () => {
    expect(testsSchemaChecked.safeParse({ calculator: "weighted", tests: [] }).success).toBe(true);
  });

  it("still catches two tests sharing a name", () => {
    const result = testsSchemaChecked.safeParse({
      calculator: "weighted",
      tests: [test("a", 100), test("a", 100)],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain("duplicate");
  });
});
