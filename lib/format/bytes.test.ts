import { describe, expect, it } from "vitest";

import { formatBytes, kilobytesAsSize } from "./bytes";

describe("formatBytes", () => {
  it("leaves small sizes in bytes, without a decimal", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(16)).toBe("16 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("steps up through binary units", () => {
    expect(formatBytes(1024)).toBe("1 KiB");
    expect(formatBytes(65536)).toBe("64 KiB");
    expect(formatBytes(1024 * 1024)).toBe("1 MiB");
    expect(formatBytes(512 * 1024 * 1024)).toBe("512 MiB");
  });

  it("keeps one decimal place where it says something, and drops a trailing zero", () => {
    expect(formatBytes(1536)).toBe("1.5 KiB");
    expect(formatBytes(2048)).toBe("2 KiB");
  });

  it("stops at gibibytes rather than inventing a unit", () => {
    expect(formatBytes(1024 ** 4)).toBe("1024 GiB");
  });
});

describe("kilobytesAsSize", () => {
  it("reads a limits field as the kilobytes core-api stores", () => {
    expect(kilobytesAsSize("1024")).toBe("1 MiB");
    expect(kilobytesAsSize(262144)).toBe("256 MiB");
  });

  it("says nothing about an empty or half-typed field", () => {
    expect(kilobytesAsSize("")).toBe("");
    expect(kilobytesAsSize(null)).toBe("");
    expect(kilobytesAsSize(undefined)).toBe("");
    expect(kilobytesAsSize("-")).toBe("");
  });

  it("stays in kibibytes below a megabyte", () => {
    expect(kilobytesAsSize("512")).toBe("512 KiB");
  });

  it("says nothing about a negative limit rather than rendering one", () => {
    expect(kilobytesAsSize("-8")).toBe("");
  });
});
