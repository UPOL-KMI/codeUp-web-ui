import { describe, expect, it } from "vitest";

import { groupSettingsSchema } from "./group-settings.schema";

/**
 * PF-004. Written to pin the *behaviour* across the move from `zod` to `zod/mini`, because that
 * swap changes how every rule is spelled and nothing else would have noticed if a `.check()`
 * landed on the wrong node -- a `minimum` attached to the wrong field, or a `superRefine` moved
 * inside `.check()` that stopped running, both typecheck perfectly.
 */
const valid = {
  texts: [{ locale: "en", name: "Algorithms", description: "" }],
  externalId: "",
  isPublic: true,
  publicStats: false,
  detaining: false,
  passMode: "none" as const,
  threshold: null,
  pointsLimit: null,
};

const issuePaths = (input: unknown): string[] => {
  const result = groupSettingsSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
};

describe("groupSettingsSchema after the zod/mini move", () => {
  it("accepts a well-formed group", () => {
    expect(groupSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it("still requires a name in at least one locale", () => {
    const blank = { ...valid, texts: [{ locale: "en", name: "   ", description: "" }] };
    expect(issuePaths(blank)).toContain("texts");
  });

  it("still requires the number the chosen pass mode reads", () => {
    expect(issuePaths({ ...valid, passMode: "threshold" })).toContain("threshold");
    expect(issuePaths({ ...valid, passMode: "pointsLimit" })).toContain("pointsLimit");
    // ...and is satisfied once it is there.
    expect(
      groupSettingsSchema.safeParse({ ...valid, passMode: "threshold", threshold: 50 }).success,
    ).toBe(true);
  });

  it("still bounds the threshold to a whole percent in (0, 100]", () => {
    for (const threshold of [0, 101, 50.5]) {
      expect(issuePaths({ ...valid, passMode: "threshold", threshold })).toContain("threshold");
    }
    expect(
      groupSettingsSchema.safeParse({ ...valid, passMode: "threshold", threshold: 100 }).success,
    ).toBe(true);
  });

  it("still bounds the points limit to a positive whole number", () => {
    for (const pointsLimit of [0, -1, 2.5]) {
      expect(issuePaths({ ...valid, passMode: "pointsLimit", pointsLimit })).toContain(
        "pointsLimit",
      );
    }
  });

  it("still trims a name but keeps the description as written", () => {
    const parsed = groupSettingsSchema.parse({
      ...valid,
      texts: [{ locale: "en", name: "  Algorithms  ", description: "  kept  " }],
    });
    expect(parsed.texts[0]!.name).toBe("Algorithms");
    expect(parsed.texts[0]!.description).toBe("  kept  ");
  });

  it("still rejects a locale shorter than two characters, and an unknown pass mode", () => {
    expect(
      issuePaths({ ...valid, texts: [{ locale: "e", name: "x", description: "" }] }),
    ).toContain("texts.0.locale");
    expect(issuePaths({ ...valid, passMode: "whatever" })).toContain("passMode");
  });
});
