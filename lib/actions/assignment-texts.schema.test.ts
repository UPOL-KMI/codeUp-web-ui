import { describe, expect, it } from "vitest";

import { assignmentTextsSchema } from "./assignment-texts.schema";

/**
 * The rules an assignment's own texts have to satisfy before core-api sees them (G-007). Worth a
 * unit test rather than only an end-to-end one because the interesting cases are the *absences* --
 * a language left blank on purpose against every language left blank by mistake -- and each is one
 * object rather than one page.
 */
const filled = { locale: "en", name: "Echo", text: "Print a greeting.", link: "" };

function issues(texts: unknown[]) {
  const result = assignmentTextsSchema.safeParse({ texts });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("assignment localized texts", () => {
  it("accepts a language with a text and one with only an external link", () => {
    expect(
      issues([
        filled,
        { locale: "cs", name: "Echo", text: "", link: "https://example.org/zadani" },
      ]),
    ).toEqual([]);
  });

  it("treats a nameless language as absent rather than as a mistake", () => {
    // This is how a translation is deleted: the action drops the row, and core-api replaces the
    // whole collection with what it is sent.
    expect(issues([filled, { locale: "cs", name: "", text: "", link: "" }])).toEqual([]);
  });

  it("refuses an assignment with no name in any language", () => {
    expect(issues([{ locale: "en", name: "  ", text: "Print a greeting.", link: "" }])).toEqual([
      "nameRequired",
    ]);
  });

  it("refuses a named language that says nothing at all", () => {
    expect(issues([{ locale: "en", name: "Echo", text: "   ", link: "" }])).toEqual(["textOrLink"]);
  });

  it("refuses a link that is not a full http address, the way core-api does", () => {
    expect(issues([{ ...filled, link: "example.org/zadani" }])).toEqual(["invalidLink"]);
    expect(issues([{ ...filled, link: "javascript:alert(1)" }])).toEqual(["invalidLink"]);
    expect(issues([{ ...filled, link: "https://example.org/zadani" }])).toEqual([]);
  });

  it("refuses an empty list, which would leave the assignment unnameable", () => {
    const result = assignmentTextsSchema.safeParse({ texts: [] });
    expect(result.success).toBe(false);
  });
});
