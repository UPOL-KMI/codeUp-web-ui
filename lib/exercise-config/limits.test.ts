import { describe, expect, it } from "vitest";

import {
  combinedCeilings,
  dataOnlyCell,
  limitsConstraints,
  readLimits,
  usesPreciseTime,
  validateLimits,
  writeLimits,
  type HardwareGroup,
  type StoredLimits,
} from "./limits";

/** The deployment's only hardware group, verbatim. */
const DEFAULT_GROUP: HardwareGroup = {
  id: "01-default",
  name: "Default Group",
  description: "This is the default group for common exercises",
  metadata: {
    memory: 1048576,
    cpuTimePerTest: 60,
    cpuTimePerExercise: 300,
    wallTimePerTest: 60,
    wallTimePerExercise: 300,
  },
};

const SMALL_GROUP: HardwareGroup = {
  id: "02-small",
  name: "Small",
  description: "",
  metadata: { memory: 65536, cpuTimePerTest: 10, cpuTimePerExercise: 30 },
};

/** The seeded exercise's limits, as core-api returns them. */
const SEEDED: StoredLimits = {
  "01-default": { python3: { "1": { "wall-time": 5, memory: 65536 } } },
};

describe("hardware group ceilings", () => {
  it("takes the tightest of several groups, filling the rest from the defaults", () => {
    const combined = combinedCeilings([DEFAULT_GROUP, SMALL_GROUP]);
    expect(combined.memory).toBe(65536);
    expect(combined.cpuTimePerTest).toBe(10);
    // The small group declares no wall-time ceiling, so the other group's stands.
    expect(combined.wallTimePerTest).toBe(60);
  });

  it("falls back to core-api's own defaults when a group declares nothing", () => {
    const bare = combinedCeilings([{ id: "x", name: "x", description: "", metadata: {} }]);
    expect(bare.memory).toBe(1024 * 1024);
    expect(bare.wallTimePerExercise).toBe(300);
  });

  it("reports the ceiling of whichever time measure is in use", () => {
    expect(limitsConstraints([SMALL_GROUP], true).time.max).toBe(10);
    expect(limitsConstraints([SMALL_GROUP], false).time.max).toBe(60);
  });
});

describe("which time measure the exercise uses", () => {
  it("follows the limits that already exist", () => {
    expect(usesPreciseTime(SEEDED, "01-default")).toBe(false);
  });

  it("defaults to processor time for an exercise with no limits", () => {
    expect(usesPreciseTime({}, "01-default")).toBe(true);
  });

  it("takes the more common of the two", () => {
    const mixed: StoredLimits = {
      g: {
        python3: { "1": { "cpu-time": 1 }, "2": { "cpu-time": 1 } },
        java: { "1": { "wall-time": 1 } },
      },
    };
    expect(usesPreciseTime(mixed, "g")).toBe(true);
  });
});

describe("readLimits", () => {
  it("reads a live grid", () => {
    const values = readLimits(SEEDED, "01-default", ["1"], ["python3"]);
    expect(values.preciseTime).toBe(false);
    expect(values.cells["1"]!.python3).toEqual({ memory: "65536", time: "5" });
  });

  it("fills a cell that has no limits with zeroes", () => {
    const values = readLimits(SEEDED, "01-default", ["1", "2"], ["python3", "java"]);
    expect(values.cells["2"]!.python3).toEqual({ memory: "0", time: "0" });
    expect(values.cells["1"]!.java).toEqual({ memory: "0", time: "0" });
  });

  it("shows a limit stored under the other time key rather than losing it", () => {
    // Every limit here is wall time, so the heuristic picks wall time and the value is read
    // directly; the interesting case is the one cell that is not.
    const mixed: StoredLimits = {
      g: {
        python3: { "1": { "cpu-time": 3, memory: 1024 }, "2": { "wall-time": 4, memory: 1024 } },
      },
    };
    const values = readLimits(mixed, "g", ["1", "2"], ["python3"]);
    expect(values.preciseTime).toBe(true);
    expect(values.cells["1"]!.python3!.time).toBe("3");
    expect(values.cells["2"]!.python3!.time).toBe("4");
  });
});

describe("the data-only seed", () => {
  it("seeds only the cells core-api holds nothing for", () => {
    const seed = { memory: "262144", time: "10" };
    const values = readLimits(SEEDED, "01-default", ["1", "2"], ["python3"], seed);
    // The stored limit wins -- seeding must not overwrite a number somebody chose.
    expect(values.cells["1"]!.python3).toEqual({ memory: "65536", time: "5" });
    expect(values.cells["2"]!.python3).toEqual(seed);
  });

  it("never seeds a value the machine would refuse", () => {
    // core-api's own validator rejects a limit above the hardware group's ceiling, so a seed that
    // ignored the ceiling would prefill the field and then mark it as out of range -- which is the
    // defect this exists to fix, reintroduced from the other side.
    expect(dataOnlyCell(SMALL_GROUP, true)).toEqual({ memory: "65536", time: "10" });
    expect(dataOnlyCell(DEFAULT_GROUP, true)).toEqual({ memory: "262144", time: "10" });
  });

  it("measures against the ceiling of the time measure actually in use", () => {
    const wallOnly: HardwareGroup = {
      ...SMALL_GROUP,
      metadata: { memory: 65536, cpuTimePerTest: 60, wallTimePerTest: 4 },
    };
    expect(dataOnlyCell(wallOnly, false).time).toBe("4");
    expect(dataOnlyCell(wallOnly, true).time).toBe("10");
  });
});

describe("writeLimits", () => {
  it("writes the grid back under the chosen time key", () => {
    const values = readLimits(SEEDED, "01-default", ["1"], ["python3"]);
    expect(writeLimits(values, "01-default", ["1"], ["python3"])).toEqual({
      "01-default": { python3: { "1": { memory: 65536, "wall-time": 5 } } },
    });
  });

  it("rewrites every cell into the other key when the measure is switched", () => {
    const values = readLimits(SEEDED, "01-default", ["1"], ["python3"]);
    values.preciseTime = true;
    const written = writeLimits(values, "01-default", ["1"], ["python3"]);
    expect(written["01-default"]!.python3!["1"]).toEqual({ memory: 65536, "cpu-time": 5 });
  });

  it("names every test of every environment, so an emptied cell is cleared and not left behind", () => {
    const values = readLimits(SEEDED, "01-default", ["1", "2"], ["python3", "java"]);
    const written = writeLimits(values, "01-default", ["1", "2"], ["python3", "java"]);
    expect(Object.keys(written["01-default"]!)).toEqual(["python3", "java"]);
    expect(Object.keys(written["01-default"]!.python3!)).toEqual(["1", "2"]);
  });

  it("survives a round trip", () => {
    const values = readLimits(SEEDED, "01-default", ["1"], ["python3"]);
    const reread = readLimits(
      writeLimits(values, "01-default", ["1"], ["python3"]),
      "01-default",
      ["1"],
      ["python3"],
    );
    expect(reread).toEqual(values);
  });
});

describe("validateLimits", () => {
  const constraints = limitsConstraints([DEFAULT_GROUP], false);

  it("accepts the seeded limits", () => {
    const values = readLimits(SEEDED, "01-default", ["1"], ["python3"]);
    expect(validateLimits(values, constraints, ["1"], ["python3"])).toEqual([]);
  });

  it("rejects a cell below the floor or above the hardware group's ceiling", () => {
    const values = readLimits(SEEDED, "01-default", ["1"], ["python3"]);
    values.cells["1"]!.python3 = { memory: "64", time: "5" };
    expect(validateLimits(values, constraints, ["1"], ["python3"])).toEqual([
      { kind: "memory", testId: "1", environmentId: "python3" },
    ]);

    values.cells["1"]!.python3 = { memory: "65536", time: "600" };
    expect(validateLimits(values, constraints, ["1"], ["python3"])).toEqual([
      { kind: "time", testId: "1", environmentId: "python3" },
    ]);
  });

  it("rejects a set of times that is fine cell by cell but too much added up", () => {
    const ids = ["1", "2", "3", "4", "5", "6"];
    const values = {
      preciseTime: false,
      cells: {} as Record<string, Record<string, { memory: string; time: string }>>,
    };
    for (const id of ids) values.cells[id] = { python3: { memory: "65536", time: "55" } };

    const problems = validateLimits(values, constraints, ids, ["python3"]);
    expect(problems).toEqual([{ kind: "total", environmentId: "python3" }]);
  });

  it("reports a cell that is not a number at all", () => {
    const values = readLimits(SEEDED, "01-default", ["1"], ["python3"]);
    values.cells["1"]!.python3 = { memory: "lots", time: "" };
    expect(validateLimits(values, constraints, ["1"], ["python3"])).toHaveLength(2);
  });
});
