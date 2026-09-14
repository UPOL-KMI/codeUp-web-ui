import { describe, expect, it } from "vitest";

import { splitGroupPoints } from "./group-points";

const rows = (...bonuses: (number | null)[]) => bonuses.map((bonus) => ({ points: { bonus } }));

describe("splitGroupPoints", () => {
  it("takes the operator's own case apart: 25/40 is 20/40 and a bonus of 5", () => {
    expect(splitGroupPoints({ points: { gained: 25, total: 40 }, assignments: rows(5) })).toEqual({
      gained: 20,
      bonus: 5,
      total: 40,
    });
  });

  it("adds up bonuses across assignments", () => {
    expect(
      splitGroupPoints({ points: { gained: 32, total: 40 }, assignments: rows(5, 2, null, 0) }),
    ).toEqual({ gained: 25, bonus: 7, total: 40 });
  });

  it("leaves a standing with no bonus exactly as it was", () => {
    expect(
      splitGroupPoints({ points: { gained: 20, total: 40 }, assignments: rows(0, null) }),
    ).toEqual({ gained: 20, bonus: 0, total: 40 });
  });

  it("handles a penalty, which is a negative bonus", () => {
    expect(splitGroupPoints({ points: { gained: 17, total: 40 }, assignments: rows(-3) })).toEqual({
      gained: 20,
      bonus: -3,
      total: 40,
    });
  });

  it("reports nothing where there are no assignment rows to read it from", () => {
    expect(splitGroupPoints({ points: { gained: 12, total: 40 }, assignments: [] })).toEqual({
      gained: 12,
      bonus: 0,
      total: 40,
    });
  });
});
