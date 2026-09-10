import { describe, expect, it } from "vitest";

import {
  DATE_FORMAT_LOCALES,
  DEFAULT_PAGES,
  dateFormatValue,
  defaultPageRoute,
  defaultPageValue,
} from "./ui-preferences";

describe("defaultPageRoute", () => {
  it("sends the dashboard preference to the dashboard", () => {
    expect(defaultPageRoute("dashboard")).toBe("/dashboard");
  });

  it("sends the home preference to the landing page", () => {
    expect(defaultPageRoute("home")).toBe("/");
  });

  it("reads legacy's third option as the landing page", () => {
    // Legacy offered `instance`, an overview screen this IA does not have: the administrator's
    // instance screens live behind /admin (DEC-113), and what a reader wants to know about their
    // instance is on the landing page. Sending them to /dashboard instead would be further from
    // what they asked for than the page that actually names their instance.
    expect(defaultPageRoute("instance")).toBe("/");
  });

  it("falls back to the dashboard for anything unset or unknown", () => {
    expect(defaultPageRoute(null)).toBe("/dashboard");
    expect(defaultPageRoute(undefined)).toBe("/dashboard");
    expect(defaultPageRoute("")).toBe("/dashboard");
    expect(defaultPageRoute("/app/some-legacy-url")).toBe("/dashboard");
  });
});

describe("defaultPageValue", () => {
  it("shows legacy's instance option back as the one it resolves to", () => {
    // Otherwise the form would display "Dashboard" while the redirect went to the landing page.
    expect(defaultPageValue("instance")).toBe("home");
  });

  it("only ever answers with something the form offers", () => {
    for (const stored of ["dashboard", "home", "instance", "", null, undefined, "nonsense"]) {
      expect(DEFAULT_PAGES).toContain(defaultPageValue(stored));
    }
  });
});

describe("dateFormatValue", () => {
  it("keeps either of the two languages core-api may have stored", () => {
    expect(dateFormatValue("cs")).toBe("cs");
    expect(dateFormatValue("en")).toBe("en");
  });

  it("reads anything else as following the interface language", () => {
    // Empty is the stored "no override", and an unrecognised value must mean the same rather than
    // being handed to Intl, which would throw on a bad locale tag.
    expect(dateFormatValue(null)).toBe("");
    expect(dateFormatValue(undefined)).toBe("");
    expect(dateFormatValue("")).toBe("");
    expect(dateFormatValue("de")).toBe("");
    expect(dateFormatValue("not-a-locale")).toBe("");
  });

  it("only ever answers with a language this app has messages for, or nothing", () => {
    for (const stored of ["cs", "en", "de", "", null]) {
      const value = dateFormatValue(stored);
      expect(value === "" || DATE_FORMAT_LOCALES.includes(value)).toBe(true);
    }
  });
});
