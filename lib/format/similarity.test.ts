import { describe, expect, it } from "vitest";

import { formatSimilarity } from "./similarity";

describe("formatSimilarity", () => {
  it("renders a ratio as whole percent", () => {
    expect(formatSimilarity(0)).toBe("0 %");
    expect(formatSimilarity(0.8734)).toBe("87 %");
    expect(formatSimilarity(1)).toBe("100 %");
  });

  it("clamps what a tool may have reported outside the range", () => {
    expect(formatSimilarity(-0.5)).toBe("0 %");
    expect(formatSimilarity(2)).toBe("100 %");
  });
});
