import { describe, expect, it } from "vitest";

import { diffLines, encodeFilePair, pairFilesByName, parseFilePairs } from "./diff";

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

describe("pairFilesByName, with pairings the reader made (G-030)", () => {
  const left = [{ name: "main.py" }, { name: "helper.py" }];
  const right = [{ name: "main.py" }, { name: "utils.py" }];

  it("pairs two files whose names differ, and marks the pair as hand-made", () => {
    const result = pairFilesByName(left, right, [{ left: "helper.py", right: "utils.py" }]);
    expect(result.pairs).toEqual([
      { left: { name: "helper.py" }, right: { name: "utils.py" }, byHand: true },
      { left: { name: "main.py" }, right: { name: "main.py" } },
    ]);
    expect(result.onlyLeft).toEqual([]);
    expect(result.onlyRight).toEqual([]);
  });

  it("takes both files out of the way of the names, so an override cannot be paired twice", () => {
    // `main.py` on the left is spoken for, so the `main.py` on the right has nothing left to
    // match and is reported as unpaired rather than quietly pairing with `helper.py`.
    const result = pairFilesByName(left, right, [{ left: "main.py", right: "utils.py" }]);
    expect(result.pairs).toEqual([
      { left: { name: "main.py" }, right: { name: "utils.py" }, byHand: true },
    ]);
    expect(result.onlyLeft).toEqual([{ name: "helper.py" }]);
    expect(result.onlyRight).toEqual([{ name: "main.py" }]);
  });

  it("ignores a pairing naming a file neither side has, rather than failing the page", () => {
    const result = pairFilesByName(left, right, [{ left: "gone.py", right: "utils.py" }]);
    expect(result.pairs).toEqual([{ left: { name: "main.py" }, right: { name: "main.py" } }]);
    expect(result.onlyLeft).toEqual([{ name: "helper.py" }]);
    expect(result.onlyRight).toEqual([{ name: "utils.py" }]);
  });

  it("keeps the first of two pairings that claim the same file", () => {
    const result = pairFilesByName(left, right, [
      { left: "helper.py", right: "utils.py" },
      { left: "helper.py", right: "main.py" },
    ]);
    expect(result.pairs).toEqual([
      { left: { name: "helper.py" }, right: { name: "utils.py" }, byHand: true },
      { left: { name: "main.py" }, right: { name: "main.py" } },
    ]);
  });

  it("refuses to use one file twice, however many pairings name it", () => {
    const result = pairFilesByName(left, right, [
      { left: "helper.py", right: "utils.py" },
      { left: "helper.py", right: "main.py" },
      { left: "main.py", right: "utils.py" },
    ]);
    expect(result.pairs).toEqual([
      { left: { name: "helper.py" }, right: { name: "utils.py" }, byHand: true },
      { left: { name: "main.py" }, right: { name: "main.py" } },
    ]);
  });
});

/**
 * The pairing arrives in the URL, so it is reader-supplied input (G-030). What most of these pin
 * is what a stale or hand-edited link may *not* do -- each is a case where trusting it verbatim
 * would fabricate a comparison or throw on the way.
 */
describe("parseFilePairs", () => {
  it("reads one pairing and several", () => {
    expect(parseFilePairs(encodeFilePair("a.c", "b.c"))).toEqual([{ left: "a.c", right: "b.c" }]);
    expect(parseFilePairs([encodeFilePair("a.c", "b.c"), encodeFilePair("x.h", "y.h")])).toEqual([
      { left: "a.c", right: "b.c" },
      { left: "x.h", right: "y.h" },
    ]);
  });

  it("survives a colon in either filename, which is why the sides are encoded", () => {
    expect(parseFilePairs(encodeFilePair("odd:name.c", "b:2.c"))).toEqual([
      { left: "odd:name.c", right: "b:2.c" },
    ]);
  });

  it("round-trips a ZIP entry, whose name already carries its archive", () => {
    const pair = encodeFilePair("archive.zip#src/main.c", "archive.zip#main.c");
    expect(parseFilePairs(pair)).toEqual([
      { left: "archive.zip#src/main.c", right: "archive.zip#main.c" },
    ]);
  });

  it("drops anything malformed instead of throwing", () => {
    expect(parseFilePairs(undefined)).toEqual([]);
    expect(parseFilePairs("")).toEqual([]);
    expect(parseFilePairs("no-separator")).toEqual([]);
    expect(parseFilePairs(":b.c")).toEqual([]);
    expect(parseFilePairs("a.c:")).toEqual([]);
    // A hand-edited URL with a broken escape must not take the page down.
    expect(parseFilePairs("%E0%A4%A:b.c")).toEqual([]);
  });
});
