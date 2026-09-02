import { describe, expect, it } from "vitest";

import {
  expressionFromWeights,
  extractWeights,
  parseScoreExpression,
  printScoreExpression,
  referencedTests,
  ScoreExpressionError,
  type ScoreNode,
} from "./score-expression";

const parse = parseScoreExpression;
const print = printScoreExpression;

describe("parsing", () => {
  it("reads a test reference, a number and a call", () => {
    expect(parse('"Test 1"')).toEqual({ type: "test-result", test: "Test 1" });
    expect(parse("0.5")).toEqual({ type: "value", value: 0.5 });
    expect(parse('avg("a", "b")')).toEqual({
      type: "avg",
      children: [
        { type: "test-result", test: "a" },
        { type: "test-result", test: "b" },
      ],
    });
  });

  it("quotes a test name so spaces and brackets in it are ordinary", () => {
    expect(parse('"Test 1 (big) [slow]."')).toEqual({
      type: "test-result",
      test: "Test 1 (big) [slow].",
    });
  });

  it("flattens a chain of + into one sum, which is how core-api shapes it", () => {
    expect(parse('"a" + "b" + "c"')).toEqual({
      type: "sum",
      children: [
        { type: "test-result", test: "a" },
        { type: "test-result", test: "b" },
        { type: "test-result", test: "c" },
      ],
    });
  });

  it("keeps - and / binary and left-associative, because sub and div take two children", () => {
    expect(parse("3 - 2 - 1")).toEqual({
      type: "sub",
      children: [
        {
          type: "sub",
          children: [
            { type: "value", value: 3 },
            { type: "value", value: 2 },
          ],
        },
        { type: "value", value: 1 },
      ],
    });
  });

  it("gives * higher precedence than +", () => {
    expect(parse("1 + 2 * 3")).toEqual({
      type: "sum",
      children: [
        { type: "value", value: 1 },
        {
          type: "mul",
          children: [
            { type: "value", value: 2 },
            { type: "value", value: 3 },
          ],
        },
      ],
    });
  });

  it("reads unary minus and clamp", () => {
    expect(parse("-1")).toEqual({ type: "neg", children: [{ type: "value", value: 1 }] });
    expect(parse('clamp("a")')).toEqual({
      type: "clamp",
      children: [{ type: "test-result", test: "a" }],
    });
  });

  it("refuses what core-api could not store, and says where", () => {
    const cases: [string, string][] = [
      ['"a" +', "unexpected-end"],
      ['avg("a"', "expected"],
      ['nope("a")', "unknown-function"],
      ['clamp("a", "b")', "clamp-arity"],
      ["avg()", "empty-call"],
      ['"unterminated', "unterminated-test"],
      ['"a" "b"', "trailing"],
      ["1 & 2", "unexpected-character"],
    ];
    for (const [source, message] of cases) {
      expect(() => parse(source), source).toThrowError(
        expect.objectContaining({ message, name: "ScoreExpressionError" }),
      );
    }
    try {
      parse('"a" + & ');
    } catch (error) {
      expect((error as ScoreExpressionError).at).toBe(6);
    }
  });
});

describe("printing", () => {
  it("parenthesises only where precedence requires it", () => {
    expect(print(parse("1 + 2 * 3"))).toBe("1 + 2 * 3");
    expect(print(parse("(1 + 2) * 3"))).toBe("(1 + 2) * 3");
    expect(print(parse("1 - (2 - 3)"))).toBe("1 - (2 - 3)");
    expect(print(parse("1 - 2 - 3"))).toBe("1 - 2 - 3");
    expect(print(parse("1 / (2 / 3)"))).toBe("1 / (2 / 3)");
  });

  it("prints calls for the functions and infix for the arithmetic", () => {
    expect(print(parse('avg("a", "b") + clamp("c")'))).toBe('avg("a", "b") + clamp("c")');
    expect(print(parse('sum("a", "b")'))).toBe('"a" + "b"');
    expect(print(parse('mul("a", "b", "c")'))).toBe('"a" * "b" * "c"');
  });

  it("round-trips every shape", () => {
    const sources = [
      '"Test 1"',
      "0.25",
      'avg("a", "b", "c")',
      'min("a", max("b", "c"))',
      '(100 * "a" + 50 * "b") / 150',
      '-clamp("a" - "b")',
      "1 - 2 - 3",
      "1 / 2 / 3",
      '"a" * ("b" + "c")',
    ];
    for (const source of sources) {
      const tree = parse(source);
      expect(parse(print(tree)), source).toEqual(tree);
    }
  });
});

describe("referencedTests", () => {
  it("names every test the expression mentions, in order", () => {
    expect(referencedTests(parse('avg("b", "a") + "b"'))).toEqual(["b", "a", "b"]);
    expect(referencedTests(parse("1 + 2"))).toEqual([]);
  });
});

describe("converting between weights and an expression", () => {
  it("writes equal weights as a plain average", () => {
    expect(expressionFromWeights({ a: 100, b: 100 })).toEqual({
      type: "avg",
      children: [
        { type: "test-result", test: "a" },
        { type: "test-result", test: "b" },
      ],
    });
  });

  it("writes unequal weights as a sum over the total", () => {
    const node = expressionFromWeights({ a: 100, b: 50 })!;
    expect(print(node)).toBe('(100 * "a" + 50 * "b") / 150');
  });

  it("writes nothing for an exercise with no tests", () => {
    expect(expressionFromWeights({})).toBeNull();
  });

  it("reads back exactly what it wrote, both shapes", () => {
    const cases: Record<string, number>[] = [
      { a: 100, b: 100 },
      { a: 100, b: 50, c: 25 },
    ];
    for (const weights of cases) {
      expect(extractWeights(expressionFromWeights(weights)!)).toEqual(weights);
    }
  });

  it("reads a bare test in the numerator as weight one", () => {
    expect(extractWeights(parse('(3 * "a" + "b") / 4'))).toEqual({ a: 3, b: 1 });
  });

  it("refuses to guess at an expression that is not an average", () => {
    // Not the total: this is a weighted average of something else, and rewriting it as weights
    // would silently change how a live exercise is graded.
    expect(extractWeights(parse('(100 * "a" + 50 * "b") / 100'))).toBeNull();
    expect(extractWeights(parse('clamp("a" - "b")'))).toBeNull();
    expect(extractWeights(parse('min("a", "b")'))).toBeNull();
    expect(extractWeights(parse('avg("a", 1)'))).toBeNull();
  });
});

describe("the tree core-api actually stores", () => {
  it("is what the parser produces, node for node", () => {
    // Shape confirmed against `helpers/exercise/testsAndScore.js`'s own construction.
    const stored: ScoreNode = {
      type: "div",
      children: [
        {
          type: "sum",
          children: [
            {
              type: "mul",
              children: [
                { type: "value", value: 100 },
                { type: "test-result", test: "Test 1" },
              ],
            },
          ],
        },
        { type: "value", value: 100 },
      ],
    };
    expect(parse(print(stored))).toEqual(stored);
    expect(extractWeights(stored)).toEqual({ "Test 1": 100 });
  });
});
