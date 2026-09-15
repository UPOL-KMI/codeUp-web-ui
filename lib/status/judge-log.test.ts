import { describe, expect, it } from "vitest";

import { isTokenJudgeLog } from "./judge-log";

describe("isTokenJudgeLog", () => {
  it("recognises the operator's own line", () => {
    expect(isTokenJudgeLog("-1/+1: [16]started.. != [16]started..?")).toBe(true);
  });

  it("recognises a line that has no counterpart, in either direction", () => {
    expect(isTokenJudgeLog("-3: ** RPN session ended **")).toBe(true);
    expect(isTokenJudgeLog("+4: something extra")).toBe(true);
  });

  it("finds the notation below other output", () => {
    expect(isTokenJudgeLog("some preamble\n-1/+1: [1]a != [1]b\n")).toBe(true);
  });

  it("says no to a custom judge's prose", () => {
    expect(isTokenJudgeLog("Your answer was off by 3.")).toBe(false);
    expect(isTokenJudgeLog("")).toBe(false);
  });

  it("does not mistake a bare negative number for the notation", () => {
    expect(isTokenJudgeLog("-1 is not the expected value")).toBe(false);
    expect(isTokenJudgeLog("result: -3: wrong")).toBe(false);
  });
});
