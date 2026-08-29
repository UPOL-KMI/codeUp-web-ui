import { describe, expect, it } from "vitest";

import { mergeRanges } from "./marked-source";

describe("mergeRanges", () => {
  it("merges overlapping and touching ranges", () => {
    expect(
      mergeRanges(
        [
          { offset: 0, length: 5 },
          { offset: 3, length: 5 },
        ],
        100,
      ),
    ).toEqual([{ offset: 0, length: 8 }]);
    expect(
      mergeRanges(
        [
          { offset: 0, length: 5 },
          { offset: 5, length: 5 },
        ],
        100,
      ),
    ).toEqual([{ offset: 0, length: 10 }]);
  });

  it("keeps a range that is entirely inside another from splitting it", () => {
    expect(
      mergeRanges(
        [
          { offset: 0, length: 20 },
          { offset: 5, length: 3 },
        ],
        100,
      ),
    ).toEqual([{ offset: 0, length: 20 }]);
  });

  it("sorts before merging, since a tool may report fragments in any order", () => {
    expect(
      mergeRanges(
        [
          { offset: 30, length: 5 },
          { offset: 10, length: 5 },
        ],
        100,
      ),
    ).toEqual([
      { offset: 10, length: 5 },
      { offset: 30, length: 5 },
    ]);
  });

  it("drops empty ranges and clips ones past the end of the file", () => {
    expect(
      mergeRanges(
        [
          { offset: 5, length: 0 },
          { offset: 200, length: 5 },
        ],
        100,
      ),
    ).toEqual([]);
    expect(mergeRanges([{ offset: 95, length: 50 }], 100)).toEqual([{ offset: 95, length: 50 }]);
  });
});
