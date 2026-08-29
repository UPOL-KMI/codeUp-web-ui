import { describe, expect, it } from "vitest";

import { parseExamLockType, phaseAt } from "./exam";

const BEGIN = 1_800_000_000;
const END = BEGIN + 7200;

describe("phaseAt", () => {
  it("has no phase when no period is set", () => {
    expect(phaseAt(BEGIN, null, null)).toBe("none");
    expect(phaseAt(BEGIN, BEGIN, null)).toBe("none");
  });

  it("is scheduled before the beginning and running from it", () => {
    expect(phaseAt(BEGIN - 1, BEGIN, END)).toBe("scheduled");
    expect(phaseAt(BEGIN, BEGIN, END)).toBe("running");
    expect(phaseAt(END - 1, BEGIN, END)).toBe("running");
  });

  it("is over at the end, not a second later", () => {
    expect(phaseAt(END, BEGIN, END)).toBe("none");
  });
});

describe("parseExamLockType", () => {
  it("accepts core-api's four values and nothing else", () => {
    expect(parseExamLockType("visible")).toBe("visible");
    expect(parseExamLockType("restricted")).toBe("restricted");
    expect(parseExamLockType("something-new")).toBeNull();
    expect(parseExamLockType(null)).toBeNull();
    expect(parseExamLockType(undefined)).toBeNull();
  });
});
