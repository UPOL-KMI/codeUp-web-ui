import { describe, expect, it } from "vitest";

import { formatPercent, formatPoints } from "./points";

describe("formatPoints", () => {
  it("renders actual/max when a maximum is known", () => {
    expect(formatPoints(7, 10)).toBe("7/10");
  });

  it("renders the bare value when there is no maximum", () => {
    expect(formatPoints(7)).toBe("7");
    expect(formatPoints(7, null)).toBe("7");
  });

  it("keeps a zero maximum visible rather than treating it as absent", () => {
    // maxPoints === 0 is a real assignment configuration (see lib/status/evaluation.ts), not a
    // missing value -- rendering it as a bare "0" would hide that the assignment is unscored.
    expect(formatPoints(0, 0)).toBe("0/0");
  });
});

describe("formatPercent", () => {
  it("rounds down so a near-perfect score never reads as perfect", () => {
    expect(formatPercent(0.996)).toBe("99%");
    expect(formatPercent(1)).toBe("100%");
  });

  it("clamps values outside the expected range", () => {
    expect(formatPercent(-3)).toBe("0%");
    expect(formatPercent(4)).toBe("100%");
  });
});
