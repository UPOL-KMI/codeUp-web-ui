import { describe, expect, it } from "vitest";

import { groupMailto } from "./mailto";

const person = (email: string | null) => ({ email });

describe("groupMailto", () => {
  it("puts every address in bcc, never in to", () => {
    const { href } = groupMailto([person("a@example.com"), person("b@example.com")]);
    expect(href).toBe("mailto:?bcc=a%40example.com,b%40example.com");
  });

  it("percent-encodes each address but leaves the separating commas alone", () => {
    const { href } = groupMailto([person("a+tag@example.com"), person("b@example.com")]);
    expect(href).toBe("mailto:?bcc=a%2Btag%40example.com,b%40example.com");
  });

  it("counts the people whose address was not disclosed, and drops them from the link", () => {
    const result = groupMailto([person("a@example.com"), person(null), person("")]);
    expect(result.addresses).toEqual(["a@example.com"]);
    expect(result.undisclosed).toBe(2);
  });

  it("offers no link at all when nothing was disclosed", () => {
    const result = groupMailto([person(null), person(null)]);
    expect(result.href).toBeNull();
    expect(result.undisclosed).toBe(2);
  });

  it("counts a repeated address once", () => {
    const result = groupMailto([person("a@example.com"), person("a@example.com")]);
    expect(result.addresses).toEqual(["a@example.com"]);
    // The duplicate is not an undisclosed address; it is the same person twice.
    expect(result.undisclosed).toBe(1);
  });

  it("stays quiet about truncation for a class that fits", () => {
    const people = Array.from({ length: 20 }, (_, index) => person(`student${index}@example.com`));
    expect(groupMailto(people).mayTruncate).toBe(false);
  });

  it("flags a list long enough for a mail client to cut short", () => {
    const people = Array.from({ length: 200 }, (_, index) => person(`student${index}@example.com`));
    const result = groupMailto(people);
    expect(result.addresses).toHaveLength(200);
    expect(result.mayTruncate).toBe(true);
  });

  it("answers an empty roster without inventing a link", () => {
    expect(groupMailto([])).toEqual({
      href: null,
      addresses: [],
      undisclosed: 0,
      mayTruncate: false,
    });
  });
});
