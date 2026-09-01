import { describe, expect, it } from "vitest";

import { readQueryToken } from "./query-token";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl";

describe("readQueryToken", () => {
  it("reads the bare query string core-api's own link templates produce", () => {
    expect(readQueryToken({ [JWT]: "" })).toBe(JWT);
  });

  it("reads a named parameter, for a deployment that overrides the template", () => {
    expect(readQueryToken({ token: JWT })).toBe(JWT);
  });

  it("prefers the named one when both are somehow present", () => {
    expect(readQueryToken({ token: JWT, "other.two.parts": "" })).toBe(JWT);
  });

  it("ignores a query string that is not a token", () => {
    expect(readQueryToken({})).toBeNull();
    expect(readQueryToken({ from: "/dashboard" })).toBeNull();
    expect(readQueryToken({ "not-a-jwt": "" })).toBeNull();
    expect(readQueryToken({ token: "" })).toBeNull();
  });
});
