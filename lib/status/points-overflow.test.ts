import { describe, expect, it } from "vitest";

import { isOverMax, moveExcessToBonus } from "./points-overflow";

describe("isOverMax", () => {
  it("catches an award above the assignment's maximum", () => {
    expect(isOverMax(30, 20)).toBe(true);
  });

  it("leaves the maximum itself alone", () => {
    expect(isOverMax(20, 20)).toBe(false);
  });

  it("says nothing about an empty field, which means the evaluation decides", () => {
    expect(isOverMax(null, 20)).toBe(false);
  });

  it("ignores a half-typed number rather than warning about NaN", () => {
    expect(isOverMax(Number.NaN, 20)).toBe(false);
    expect(isOverMax(20.5, 20)).toBe(false);
  });

  it("does not fire on a zero-point assignment's zero", () => {
    expect(isOverMax(0, 0)).toBe(false);
  });
});

describe("moveExcessToBonus", () => {
  it("splits the operator's own example", () => {
    expect(moveExcessToBonus(30, 0, 20)).toEqual({ override: 20, bonus: 10 });
  });

  it("keeps the total when a bonus was already typed", () => {
    const { override, bonus } = moveExcessToBonus(30, 2, 20);
    expect({ override, bonus }).toEqual({ override: 20, bonus: 12 });
    expect(override + bonus).toBe(32);
  });

  it("adds to a negative bonus rather than replacing it", () => {
    expect(moveExcessToBonus(25, -3, 20)).toEqual({ override: 20, bonus: 2 });
  });

  it("turns the whole award into bonus on an assignment worth nothing", () => {
    expect(moveExcessToBonus(5, 0, 0)).toEqual({ override: 0, bonus: 5 });
  });
});
