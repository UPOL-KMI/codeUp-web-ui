import { describe, expect, it } from "vitest";

import { formatExitCodes, isValidExitCodes, parseExitCodes } from "./exit-codes";

describe("exit codes", () => {
  it("accepts values and intervals", () => {
    expect(isValidExitCodes("0")).toBe(true);
    expect(isValidExitCodes("1, 3, 5-7")).toBe(true);
    expect(isValidExitCodes(" 0 , 255 ")).toBe(true);
  });

  it("rejects anything that is not a code in range", () => {
    expect(isValidExitCodes("abc")).toBe(false);
    expect(isValidExitCodes("256")).toBe(false);
    expect(isValidExitCodes("1;2")).toBe(false);
    expect(isValidExitCodes("")).toBe(false);
  });

  it("normalises overlapping and unordered input", () => {
    expect(parseExitCodes("3, 1-2, 2")).toEqual(["1-3"]);
    expect(parseExitCodes("5-3")).toEqual(["3-5"]);
    expect(parseExitCodes("0, 2-4, 9")).toEqual(["0", "2-4", "9"]);
  });

  it("yields no codes for an unparseable string rather than guessing", () => {
    expect(parseExitCodes("1, oops")).toEqual([]);
  });

  it("reads an absent list as the default of zero", () => {
    expect(formatExitCodes(undefined)).toBe("0");
    expect(formatExitCodes([])).toBe("0");
    expect(formatExitCodes(["0", "2-4"])).toBe("0, 2-4");
  });

  it("round-trips a normalised string unchanged", () => {
    expect(formatExitCodes(parseExitCodes("0, 2-4"))).toBe("0, 2-4");
  });
});
