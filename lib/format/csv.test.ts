import { describe, expect, it } from "vitest";

import { csvDocument, csvFileName, toCsv } from "./csv";

describe("toCsv", () => {
  it("separates with semicolons and CRLF", () => {
    expect(
      toCsv([
        ["a", "b"],
        [1, 2],
      ]),
    ).toBe("a;b\r\n1;2");
  });

  it("quotes only what needs it, and doubles embedded quotes", () => {
    expect(toCsv([["plain", 'Task "A"', "a;b", "two\nlines"]])).toBe(
      'plain;"Task ""A""";"a;b";"two\nlines"',
    );
  });

  it("writes an empty field for a missing value, and a zero for zero", () => {
    expect(toCsv([[null, undefined, 0, ""]])).toBe(";;0;");
  });

  it("prefixes the document with a UTF-8 BOM", () => {
    expect(csvDocument([["Jiří"]])).toBe("﻿Jiří\r\n");
  });
});

describe("csvFileName", () => {
  it("keeps an ordinary name", () => {
    expect(csvFileName("Intro to Programming", "group")).toBe("Intro to Programming.csv");
  });

  it("strips path separators, quotes and control characters", () => {
    expect(csvFileName('Intro / Lab "A"\n', "group")).toBe("Intro Lab A.csv");
  });

  it("falls back when nothing usable is left", () => {
    expect(csvFileName("///", "group")).toBe("group.csv");
  });
});
