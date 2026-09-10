import { describe, expect, it } from "vitest";

import {
  restrictedTokenRequest,
  SUPERADMIN_TOKEN_SCOPES,
  TOKEN_EXPIRATIONS,
  TOKEN_SCOPES,
} from "./restricted-token";

describe("restrictedTokenRequest", () => {
  it("asks for the one scope chosen", () => {
    expect(
      restrictedTokenRequest({ scope: "read-all", expiration: 86400, refresh: false }),
    ).toEqual({ scopes: ["read-all"], expiration: 86400 });
  });

  it("adds refresh as a second scope rather than a flag", () => {
    // The mistake this function exists to prevent: core-api reads TokenScope::REFRESH out of the
    // same array, so a `refresh: true` property would be silently ignored.
    const body = restrictedTokenRequest({ scope: "master", expiration: 3600, refresh: true });
    expect(body.scopes).toEqual(["master", "refresh"]);
    expect(body).not.toHaveProperty("refresh");
  });

  it("keeps the chosen scope first, so core-api's error names it", () => {
    const body = restrictedTokenRequest({ scope: "plagiarism", expiration: 604800, refresh: true });
    expect(body.scopes[0]).toBe("plagiarism");
  });
});

describe("the offered vocabulary", () => {
  it("matches core-api's TokenScope for everything a form may ask for", () => {
    expect(TOKEN_SCOPES).toEqual(["master", "read-all", "plagiarism", "ref-solutions"]);
  });

  it("offers a superadmin one more, and only one more", () => {
    expect(SUPERADMIN_TOKEN_SCOPES).toEqual([...TOKEN_SCOPES, "group-external"]);
  });

  it("never offers a scope core-api refuses outright", () => {
    // validateScopeRoles() rejects both of these: they may only arrive by email.
    expect(SUPERADMIN_TOKEN_SCOPES).not.toContain("change-password");
    expect(SUPERADMIN_TOKEN_SCOPES).not.toContain("email-verification");
  });

  it("corrects the legacy form's 356-day year", () => {
    expect(TOKEN_EXPIRATIONS).toContain(365 * 24 * 3600);
    expect(TOKEN_EXPIRATIONS).not.toContain(356 * 24 * 3600);
  });

  it("offers lifetimes in ascending order, shortest first", () => {
    expect([...TOKEN_EXPIRATIONS]).toEqual([...TOKEN_EXPIRATIONS].sort((a, b) => a - b));
    expect(TOKEN_EXPIRATIONS[0]).toBe(3600);
  });
});
