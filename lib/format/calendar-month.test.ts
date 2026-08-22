import { describe, expect, it } from "vitest";

import {
  formatMonthParam,
  monthGrid,
  monthOf,
  parseMonthParam,
  shiftMonth,
  weekdayIndex,
} from "./calendar-month";

describe("weekdayIndex", () => {
  it("puts Monday in the first column and Sunday in the last", () => {
    expect(weekdayIndex("2026-08-24")).toBe(0); // a Monday
    expect(weekdayIndex("2026-08-30")).toBe(6); // the Sunday after it
  });
});

describe("shiftMonth", () => {
  it("moves within a year", () => {
    expect(shiftMonth({ year: 2026, month: 8 }, 1)).toEqual({ year: 2026, month: 9 });
  });

  it("rolls over both year boundaries", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("parseMonthParam", () => {
  it("accepts a well-formed value", () => {
    expect(parseMonthParam("2026-03", "2026-08-22")).toEqual({ year: 2026, month: 3 });
  });

  it("falls back to the month containing today rather than failing", () => {
    for (const bad of [undefined, "", "nonsense", "2026-13", "2026-00", "26-3", "0000-05"]) {
      expect(parseMonthParam(bad, "2026-08-22")).toEqual({ year: 2026, month: 8 });
    }
  });
});

describe("formatMonthParam / monthOf", () => {
  it("round-trips", () => {
    expect(formatMonthParam(monthOf("2026-08-22"))).toBe("2026-08");
  });

  it("pads single-digit months", () => {
    expect(formatMonthParam({ year: 2026, month: 3 })).toBe("2026-03");
  });
});

describe("monthGrid", () => {
  it("draws whole weeks that start on Monday", () => {
    const { weeks } = monthGrid({ year: 2026, month: 8 });
    for (const week of weeks) {
      expect(week).toHaveLength(7);
      expect(weekdayIndex(week[0]!)).toBe(0);
    }
  });

  it("covers the month, with neighbouring days in the leading and trailing cells", () => {
    const { weeks, first, last } = monthGrid({ year: 2026, month: 8 });
    const days = weeks.flat();
    expect(days[0]).toBe(first);
    expect(days[days.length - 1]).toBe(last);
    expect(days).toContain("2026-08-01");
    expect(days).toContain("2026-08-31");
    // August 2026 starts on a Saturday, so the grid opens in July and closes in September.
    expect(first).toBe("2026-07-27");
    expect(last).toBe("2026-09-06");
  });

  it("handles a month that starts on a Monday without an empty leading week", () => {
    const { weeks, first } = monthGrid({ year: 2026, month: 6 }); // 1 June 2026 is a Monday
    expect(first).toBe("2026-06-01");
    expect(weeks[0]![0]).toBe("2026-06-01");
  });

  it("spans a leap day", () => {
    const days = monthGrid({ year: 2028, month: 2 }).weeks.flat();
    expect(days).toContain("2028-02-29");
  });
});
