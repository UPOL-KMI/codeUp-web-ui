import { describe, expect, it } from "vitest";

import { hoursMinutesToSeconds, secondsToHoursMinutes } from "./duration";

describe("secondsToHoursMinutes", () => {
  it("pads minutes and does not pad hours, like the legacy form", () => {
    expect(secondsToHoursMinutes(7200)).toBe("2:00");
    expect(secondsToHoursMinutes(5400)).toBe("1:30");
    expect(secondsToHoursMinutes(300)).toBe("0:05");
    expect(secondsToHoursMinutes(86400)).toBe("24:00");
  });

  it("truncates seconds rather than rounding them up into a minute", () => {
    expect(secondsToHoursMinutes(119)).toBe("0:01");
  });

  it("is empty for a negative duration", () => {
    expect(secondsToHoursMinutes(-1)).toBe("");
  });
});

describe("hoursMinutesToSeconds", () => {
  it("reads h:mm", () => {
    expect(hoursMinutesToSeconds("2:00")).toBe(7200);
    expect(hoursMinutesToSeconds(" 1:30 ")).toBe(5400);
    expect(hoursMinutesToSeconds("0:01")).toBe(60);
  });

  it("rejects anything that is not h:mm", () => {
    expect(hoursMinutesToSeconds("2")).toBeNull();
    expect(hoursMinutesToSeconds("2:5")).toBeNull();
    expect(hoursMinutesToSeconds("2:60")).toBeNull();
    expect(hoursMinutesToSeconds("")).toBeNull();
    expect(hoursMinutesToSeconds("half an hour")).toBeNull();
  });

  it("round-trips every value the form can produce", () => {
    for (const seconds of [60, 300, 3600, 5400, 7200, 86400]) {
      expect(hoursMinutesToSeconds(secondsToHoursMinutes(seconds))).toBe(seconds);
    }
  });
});
