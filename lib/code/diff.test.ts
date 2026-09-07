import { describe, expect, it } from "vitest";

import { diffLines, pairFilesByName } from "./diff";

describe("diffLines", () => {
  it("says two identical files are identical, and numbers every line on both sides", () => {
    const result = diffLines("a\nb\nc\n", "a\nb\nc\n");
    expect(result.identical).toBe(true);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.rows.map((row) => [row.leftNumber, row.rightNumber])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it("keeps the common lines and marks only what moved", () => {
    const result = diffLines("a\nb\nc\n", "a\nx\nc\n");
    expect(result.rows.map((row) => `${row.kind}:${row.text}`)).toEqual([
      "equal:a",
      "removed:b",
      "added:x",
      "equal:c",
    ]);
    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
    expect(result.identical).toBe(false);
  });

  it("numbers each side by its own file, so a removal does not shift the right column", () => {
    const result = diffLines("a\nb\nc\n", "a\nc\n");
    expect(result.rows).toEqual([
      { kind: "equal", leftNumber: 1, rightNumber: 1, text: "a" },
      { kind: "removed", leftNumber: 2, rightNumber: null, text: "b" },
      { kind: "equal", leftNumber: 3, rightNumber: 2, text: "c" },
    ]);
  });

  it("handles a file that gained lines at the end, and one that lost them", () => {
    expect(diffLines("a\n", "a\nb\nc\n").added).toBe(2);
    expect(diffLines("a\nb\nc\n", "a\n").removed).toBe(2);
  });

  it("treats an empty file as empty rather than as one blank line", () => {
    expect(diffLines("", "").rows).toEqual([]);
    expect(diffLines("", "a\n").rows.map((row) => row.kind)).toEqual(["added"]);
  });

  it("does not end a file with a phantom blank line when it ends in a newline", () => {
    expect(diffLines("a\n", "a\n").rows).toHaveLength(1);
    // ...but a genuinely blank last line is a line.
    expect(diffLines("a\n\n", "a\n").rows.map((row) => row.kind)).toEqual(["equal", "removed"]);
  });

  it("compares by exact text, so indentation is a difference and not noise", () => {
    const result = diffLines("if x:\n    y()\n", "if x:\n\ty()\n");
    expect(result.identical).toBe(false);
    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
  });

  it("finds the longest common subsequence rather than the first alignment that fits", () => {
    // A naive line-by-line walk reports four changes here; the common run "b c d" is three lines.
    const result = diffLines("x\nb\nc\nd\n", "b\nc\nd\ny\n");
    expect(result.rows.filter((row) => row.kind === "equal").map((row) => row.text)).toEqual([
      "b",
      "c",
      "d",
    ]);
    expect(result.removed).toBe(1);
    expect(result.added).toBe(1);
  });
});

describe("pairFilesByName", () => {
  it("pairs files with the same name and reports the rest on the side they came from", () => {
    const result = pairFilesByName(
      [{ name: "main.py" }, { name: "helper.py" }],
      [{ name: "main.py" }, { name: "extra.py" }],
    );
    expect(result.pairs).toEqual([{ left: { name: "main.py" }, right: { name: "main.py" } }]);
    expect(result.onlyLeft).toEqual([{ name: "helper.py" }]);
    expect(result.onlyRight).toEqual([{ name: "extra.py" }]);
  });

  it("pairs nothing when no name matches, rather than pairing what is left over", () => {
    const result = pairFilesByName([{ name: "a.py" }], [{ name: "b.py" }]);
    expect(result.pairs).toEqual([]);
    expect(result.onlyLeft).toHaveLength(1);
    expect(result.onlyRight).toHaveLength(1);
  });

  it("pairs an archive entry by its full name, archive and all", () => {
    const result = pairFilesByName(
      [{ name: "src.zip#main.c" }],
      [{ name: "src.zip#main.c" }, { name: "other.zip#main.c" }],
    );
    expect(result.pairs).toHaveLength(1);
    expect(result.onlyRight).toEqual([{ name: "other.zip#main.c" }]);
  });

  it("uses each right-hand file once, even when the left repeats a name", () => {
    const result = pairFilesByName([{ name: "a.py" }, { name: "a.py" }], [{ name: "a.py" }]);
    expect(result.pairs).toHaveLength(1);
    expect(result.onlyLeft).toHaveLength(1);
  });
});
