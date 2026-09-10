import { describe, expect, it } from "vitest";

import {
  applyManualPairs,
  diffLines,
  encodeFilePair,
  pairFilesByName,
  parseFilePairs,
} from "./diff";

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

/**
 * G-030. What these pin is mostly what a *stale or hand-edited* link may not do: the pairing
 * arrives in the URL, so it is reader-supplied input and every one of these is a case where
 * trusting it would fabricate a comparison.
 */
describe("parseFilePairs", () => {
  it("reads one pairing and several", () => {
    expect(parseFilePairs(encodeFilePair("a.c", "b.c"))).toEqual([["a.c", "b.c"]]);
    expect(parseFilePairs([encodeFilePair("a.c", "b.c"), encodeFilePair("x.h", "y.h")])).toEqual([
      ["a.c", "b.c"],
      ["x.h", "y.h"],
    ]);
  });

  it("survives a colon in either filename, which is why the sides are encoded", () => {
    expect(parseFilePairs(encodeFilePair("odd:name.c", "b:2.c"))).toEqual([
      ["odd:name.c", "b:2.c"],
    ]);
  });

  it("round-trips a ZIP entry, whose name already carries its archive", () => {
    const pair = encodeFilePair("archive.zip#src/main.c", "archive.zip#main.c");
    expect(parseFilePairs(pair)).toEqual([["archive.zip#src/main.c", "archive.zip#main.c"]]);
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

describe("applyManualPairs", () => {
  const file = (name: string) => ({ name });
  const pairing = {
    pairs: [{ left: file("same.c"), right: file("same.c") }],
    onlyLeft: [file("main.py"), file("extra.py")],
    onlyRight: [file("solution.py"), file("spare.py")],
  };

  it("moves the chosen files out of the unpaired lists", () => {
    const result = applyManualPairs(pairing, [["main.py", "solution.py"]]);
    expect(result.pairs).toHaveLength(2);
    expect(result.pairs[1]).toEqual({ left: file("main.py"), right: file("solution.py") });
    expect(result.onlyLeft.map((f) => f.name)).toEqual(["extra.py"]);
    expect(result.onlyRight.map((f) => f.name)).toEqual(["spare.py"]);
  });

  it("keeps the name-based pairs and their order", () => {
    const result = applyManualPairs(pairing, [["extra.py", "spare.py"]]);
    expect(result.pairs[0]).toEqual(pairing.pairs[0]);
  });

  it("ignores a pairing naming a file that is not unpaired", () => {
    // `same.c` already matched by name: re-pairing it would show one file twice.
    expect(applyManualPairs(pairing, [["same.c", "solution.py"]]).pairs).toHaveLength(1);
    expect(applyManualPairs(pairing, [["main.py", "same.c"]]).pairs).toHaveLength(1);
  });

  it("ignores a pairing naming a file that does not exist at all", () => {
    expect(applyManualPairs(pairing, [["ghost.py", "solution.py"]]).pairs).toHaveLength(1);
  });

  it("refuses to use one file twice", () => {
    const result = applyManualPairs(pairing, [
      ["main.py", "solution.py"],
      ["main.py", "spare.py"],
      ["extra.py", "solution.py"],
    ]);
    expect(result.pairs).toHaveLength(2);
    expect(result.onlyLeft.map((f) => f.name)).toEqual(["extra.py"]);
    expect(result.onlyRight.map((f) => f.name)).toEqual(["spare.py"]);
  });

  it("leaves the pairing alone when nothing was asked for", () => {
    expect(applyManualPairs(pairing, [])).toEqual(pairing);
  });
});
