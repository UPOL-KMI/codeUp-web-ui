import { describe, expect, it } from "vitest";

import { safeRedirectTarget } from "./redirect-target";

describe("safeRedirectTarget", () => {
  it("keeps a path on this app, without its locale prefix", () => {
    expect(safeRedirectTarget("/en/groups/abc?tab=students")).toBe("/groups/abc?tab=students");
    expect(safeRedirectTarget("/cs/dashboard")).toBe("/dashboard");
    expect(safeRedirectTarget("/exercises")).toBe("/exercises");
  });

  it("falls back when there is nothing to go back to", () => {
    expect(safeRedirectTarget(undefined)).toBe("/dashboard");
    expect(safeRedirectTarget("")).toBe("/dashboard");
    expect(safeRedirectTarget("/en")).toBe("/dashboard");
  });

  it("refuses anything that could leave this app", () => {
    expect(safeRedirectTarget("//evil.example/phish")).toBe("/dashboard");
    expect(safeRedirectTarget("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectTarget("/\\evil.example")).toBe("/dashboard");
    expect(safeRedirectTarget("javascript:alert(1)")).toBe("/dashboard");
    expect(safeRedirectTarget("dashboard")).toBe("/dashboard");
  });

  it("does not mistake a path that merely starts with a locale-like segment", () => {
    expect(safeRedirectTarget("/entries/1")).toBe("/entries/1");
    expect(safeRedirectTarget("/csv-export")).toBe("/csv-export");
  });
});
