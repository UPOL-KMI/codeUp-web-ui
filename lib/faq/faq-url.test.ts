import { describe, expect, it } from "vitest";

import { DEFAULT_FAQ_URI, resolveFaqUrl } from "./faq-url";

describe("resolveFaqUrl", () => {
  it("falls back to the project wiki when the deployment configures nothing", () => {
    expect(resolveFaqUrl(undefined, "en")).toBe(DEFAULT_FAQ_URI);
    expect(resolveFaqUrl("", "cs")).toBe(DEFAULT_FAQ_URI);
    expect(resolveFaqUrl("   ", "cs")).toBe(DEFAULT_FAQ_URI);
  });

  it("uses one configured URL for every locale", () => {
    expect(resolveFaqUrl("https://example.org/faq.md", "cs")).toBe("https://example.org/faq.md");
    expect(resolveFaqUrl("http://example.org/faq.md", "en")).toBe("http://example.org/faq.md");
  });

  it("picks the reader's own locale out of a mapping", () => {
    const configured = '{"en":"https://example.org/en.md","cs":"https://example.org/cs.md"}';
    expect(resolveFaqUrl(configured, "cs")).toBe("https://example.org/cs.md");
    expect(resolveFaqUrl(configured, "en")).toBe("https://example.org/en.md");
  });

  it("falls back to English, then to whatever the mapping does have", () => {
    const withEnglish = '{"en":"https://example.org/en.md","de":"https://example.org/de.md"}';
    expect(resolveFaqUrl(withEnglish, "cs")).toBe("https://example.org/en.md");

    const withoutEnglish = '{"de":"https://example.org/de.md"}';
    expect(resolveFaqUrl(withoutEnglish, "cs")).toBe("https://example.org/de.md");
  });

  it("skips a mapping entry that is not a usable URL rather than resolving to it", () => {
    expect(resolveFaqUrl('{"cs":"","en":"https://example.org/en.md"}', "cs")).toBe(
      "https://example.org/en.md",
    );
    expect(resolveFaqUrl('{"cs":42,"de":"https://example.org/de.md"}', "cs")).toBe(
      "https://example.org/de.md",
    );
  });

  it("refuses anything that is not an absolute http(s) URL", () => {
    // This app fetches the document server-side, so a mistyped variable would otherwise decide
    // what its own server connects to. The page renders these as "could not be loaded".
    expect(resolveFaqUrl("file:///etc/passwd", "en")).toBeNull();
    expect(resolveFaqUrl("/faq.md", "en")).toBeNull();
    expect(resolveFaqUrl("not a url", "en")).toBeNull();
    expect(resolveFaqUrl('{"en":"file:///etc/passwd"}', "en")).toBeNull();
  });

  it("refuses a mapping that is not an object of locales", () => {
    expect(resolveFaqUrl("{", "en")).toBeNull();
    expect(resolveFaqUrl("{}", "en")).toBeNull();
  });
});
