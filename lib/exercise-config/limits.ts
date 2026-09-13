/**
 * An exercise's resource limits (T-010): how much memory and how much time each test is allowed,
 * per language and per hardware group.
 *
 * core-api keys them three deep -- `[hardware group][environment][test]` -- and returns `null` for
 * a pair that has none. The form is a grid per hardware group, tests down and languages across,
 * which is the legacy shape and the only one in which "this test is slower everywhere" is visible.
 *
 * **Time is measured one of two ways and the exercise picks one.** A limit is either `wall-time`
 * (how long it actually took, including waiting) or `cpu-time` (how long it was running).
 * core-api stores whichever key was written and does not say which the exercise means, so the
 * choice is inferred from what most of the existing limits use -- the legacy heuristic, reproduced
 * here -- and is then a switch on the form. Flipping it rewrites every cell into the other key,
 * which is why it is a deliberate control rather than a hidden detail.
 *
 * **What the numbers may be is the hardware group's business.** Its `metadata` carries the
 * ceilings (`memory`, `cpuTimePerTest`, `wallTimePerTest`) and, separately, a ceiling on the
 * *total* time an exercise may take (`cpuTimePerExercise`, `wallTimePerExercise`) -- so a set of
 * limits that is fine cell by cell can still be refused for adding up. Where an exercise has
 * several hardware groups the tightest of them wins, because the limits have to hold on all.
 */
export interface HardwareGroupMetadata {
  memory?: number;
  cpuTimePerTest?: number;
  cpuTimePerExercise?: number;
  wallTimePerTest?: number;
  wallTimePerExercise?: number;
}

export interface HardwareGroup {
  id: string;
  name: string;
  description: string;
  metadata: HardwareGroupMetadata;
}

/** One test's limits as core-api stores them. Exactly one of the two time keys is present. */
export interface StoredLimit {
  memory?: number;
  "wall-time"?: number;
  "cpu-time"?: number;
}

/** `[hardware group][environment][test]`, with `null` where a pair has no limits at all. */
export type StoredLimits = Record<string, Record<string, Record<string, StoredLimit> | null>>;

export interface LimitCell {
  /** Kibibytes, as typed. */
  memory: string;
  /** Seconds, as typed. */
  time: string;
}

export interface LimitsValues {
  /** True when the exercise measures processor time rather than elapsed time. */
  preciseTime: boolean;
  /** `[test id][environment id]` -- the grid, in the order the form renders it. */
  cells: Record<string, Record<string, LimitCell>>;
}

export const MIN_MEMORY = 128;
export const MIN_TIME = 0.1;

const DEFAULT_CEILINGS: Required<HardwareGroupMetadata> = {
  memory: 1024 * 1024,
  cpuTimePerTest: 60,
  cpuTimePerExercise: 300,
  wallTimePerTest: 60,
  wallTimePerExercise: 300,
};

/** The tightest ceiling across every hardware group the exercise runs on. */
export function combinedCeilings(groups: HardwareGroup[]): Required<HardwareGroupMetadata> {
  const result = { ...DEFAULT_CEILINGS };
  for (const key of Object.keys(DEFAULT_CEILINGS) as (keyof HardwareGroupMetadata)[]) {
    const values = groups
      .map((group) => group.metadata[key])
      .filter((value): value is number => typeof value === "number" && value > 0);
    if (values.length > 0) result[key] = Math.min(...values);
  }
  return result;
}

export interface LimitsConstraints {
  memory: { min: number; max: number };
  time: { min: number; max: number };
  totalTime: { min: number; max: number };
}

export function limitsConstraints(
  groups: HardwareGroup[],
  preciseTime: boolean,
): LimitsConstraints {
  const ceilings = combinedCeilings(groups);
  return {
    memory: { min: MIN_MEMORY, max: ceilings.memory },
    time: {
      min: MIN_TIME,
      max: preciseTime ? ceilings.cpuTimePerTest : ceilings.wallTimePerTest,
    },
    totalTime: {
      min: MIN_TIME,
      max: preciseTime ? ceilings.cpuTimePerExercise : ceilings.wallTimePerExercise,
    },
  };
}

/**
 * Which of the two time measures this exercise uses, decided the way the legacy form decides it:
 * whichever key more of the existing limits carry, and processor time on a tie -- including the
 * tie an exercise with no limits at all starts from, where it is simply the better default.
 */
export function usesPreciseTime(limits: StoredLimits, hardwareGroupId: string): boolean {
  let wall = 0;
  let cpu = 0;
  for (const environment of Object.values(limits[hardwareGroupId] ?? {})) {
    for (const limit of Object.values(environment ?? {})) {
      if (limit["wall-time"]) wall++;
      if (limit["cpu-time"]) cpu++;
    }
  }
  return cpu >= wall;
}

/**
 * What an unset cell is seeded with for an exercise that runs no student code (DEC-141).
 *
 * core-api demands a memory limit and one of the two time limits on **every** test, the data-only
 * one included -- an exercise whose single test has 0/0 is refused with "needs to have a memory
 * limit" (`ExerciseLimitsValidator`). Nothing of the student's runs there, but the judge does, so
 * the numbers cannot be zero and asking a teacher collecting essays to invent a processor-time
 * budget is asking the wrong person the wrong question. These are deliberately generous: enough
 * for any judge that reads a file, far below what the machines here allow, and clamped to the
 * hardware group's own ceilings by the caller in case a machine is smaller than that.
 */
export const DATA_ONLY_LIMITS = { memory: 262144, time: 10 };

/**
 * Clamps the data-only seed to what this hardware group actually permits, so the prefilled value
 * can never be the one the form then marks as out of range.
 */
export function dataOnlyCell(group: HardwareGroup, preciseTime: boolean): LimitCell {
  const perTest = preciseTime
    ? group.metadata.cpuTimePerTest
    : (group.metadata.wallTimePerTest ?? group.metadata.cpuTimePerTest);
  return {
    memory: String(Math.min(DATA_ONLY_LIMITS.memory, group.metadata.memory ?? Infinity)),
    time: String(Math.min(DATA_ONLY_LIMITS.time, perTest ?? Infinity)),
  };
}

export function readLimits(
  limits: StoredLimits,
  hardwareGroupId: string,
  testIds: string[],
  environmentIds: string[],
  /** Seeds cells core-api holds nothing for. Omitted, an unset cell reads as 0, which is how an
   *  ordinary exercise says "the teacher has not decided yet". */
  unset?: LimitCell,
): LimitsValues {
  const preciseTime = usesPreciseTime(limits, hardwareGroupId);
  const group = limits[hardwareGroupId] ?? {};

  const cells: Record<string, Record<string, LimitCell>> = {};
  for (const testId of testIds) {
    cells[testId] = {};
    for (const environmentId of environmentIds) {
      const limit = group[environmentId]?.[testId];
      // The other measure is shown rather than blanked when only it is set: a limit written as
      // wall time is still a number somebody chose, and reading it as "unset" would lose it on
      // the next save.
      const time =
        limit?.[preciseTime ? "cpu-time" : "wall-time"] ??
        limit?.[preciseTime ? "wall-time" : "cpu-time"];
      cells[testId]![environmentId] = {
        memory: limit?.memory !== undefined ? String(limit.memory) : (unset?.memory ?? "0"),
        time: time !== undefined ? String(time) : (unset?.time ?? "0"),
      };
    }
  }

  return { preciseTime, cells };
}

export function writeLimits(
  values: LimitsValues,
  hardwareGroupId: string,
  testIds: string[],
  environmentIds: string[],
): StoredLimits {
  const timeKey = values.preciseTime ? "cpu-time" : "wall-time";
  const environments: Record<string, Record<string, StoredLimit>> = {};

  for (const environmentId of environmentIds) {
    const tests: Record<string, StoredLimit> = {};
    for (const testId of testIds) {
      const cell = values.cells[testId]?.[environmentId];
      tests[testId] = {
        memory: Number(cell?.memory ?? 0),
        [timeKey]: Number(cell?.time ?? 0),
      };
    }
    environments[environmentId] = tests;
  }

  return { [hardwareGroupId]: environments };
}

export interface LimitsProblem {
  kind: "memory" | "time" | "total";
  testId?: string;
  environmentId: string;
}

/**
 * Every cell core-api would refuse, plus the per-language totals that would exceed the exercise
 * ceiling. Reported all at once rather than one at a time: a grid is edited as a grid.
 */
export function validateLimits(
  values: LimitsValues,
  constraints: LimitsConstraints,
  testIds: string[],
  environmentIds: string[],
): LimitsProblem[] {
  const problems: LimitsProblem[] = [];
  const totals: Record<string, number> = {};

  for (const testId of testIds) {
    for (const environmentId of environmentIds) {
      const cell = values.cells[testId]?.[environmentId];
      const memory = Number(cell?.memory);
      const time = Number(cell?.time);

      if (
        !Number.isFinite(memory) ||
        memory < constraints.memory.min ||
        memory > constraints.memory.max
      ) {
        problems.push({ kind: "memory", testId, environmentId });
      }
      if (!Number.isFinite(time) || time < constraints.time.min || time > constraints.time.max) {
        problems.push({ kind: "time", testId, environmentId });
      } else {
        totals[environmentId] = (totals[environmentId] ?? 0) + time;
      }
    }
  }

  for (const [environmentId, total] of Object.entries(totals)) {
    if (total > constraints.totalTime.max) problems.push({ kind: "total", environmentId });
  }

  return problems;
}
