import { describe, expect, it } from "vitest";

import { groupTeacherIds } from "./teachers";

describe("groupTeacherIds", () => {
  it("merges admins and supervisors with the primary admins, without repeating one", () => {
    expect(
      groupTeacherIds({
        primaryAdminsIds: ["a"],
        privateData: { admins: ["a", "b"], supervisors: ["c"] },
      }),
    ).toEqual(["a", "b", "c"]);
  });

  it("falls back to the public primary admins where privateData is withheld", () => {
    expect(groupTeacherIds({ primaryAdminsIds: ["a"], privateData: null })).toEqual(["a"]);
  });

  it("leaves out observers by saying nothing about them", () => {
    expect(
      groupTeacherIds({ privateData: { admins: ["a"], supervisors: [] } } as GroupWithObservers),
    ).toEqual(["a"]);
  });

  it("is empty for a thread with no group behind it", () => {
    expect(groupTeacherIds(null)).toEqual([]);
    expect(groupTeacherIds(undefined)).toEqual([]);
  });
});

type GroupWithObservers = Parameters<typeof groupTeacherIds>[0];
