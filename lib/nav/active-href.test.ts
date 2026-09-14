import { describe, expect, it } from "vitest";

import { activeNavHref } from "./active-href";

const sidebar = [
  "/dashboard",
  "/groups",
  "/groups/abc",
  "/exercises",
  "/admin",
  "/admin/instances",
];

describe("activeNavHref", () => {
  it("highlights the group, not the list above it", () => {
    expect(activeNavHref(sidebar, "/groups/abc")).toBe("/groups/abc");
  });

  it("stays on the group while the reader is inside it", () => {
    expect(activeNavHref(sidebar, "/groups/abc/assign")).toBe("/groups/abc");
  });

  it("falls back to the list for a group the sidebar does not hold", () => {
    expect(activeNavHref(sidebar, "/groups/other")).toBe("/groups");
  });

  it("highlights the list on the list", () => {
    expect(activeNavHref(sidebar, "/groups")).toBe("/groups");
  });

  it("prefers the deeper admin link over its parent", () => {
    expect(activeNavHref(sidebar, "/admin/instances/xyz")).toBe("/admin/instances");
  });

  it("matches whole segments, not string prefixes", () => {
    expect(activeNavHref(sidebar, "/exercises-archive")).toBeNull();
  });

  it("returns null where nothing in the sidebar contains the path", () => {
    expect(activeNavHref(sidebar, "/profile")).toBeNull();
  });
});
