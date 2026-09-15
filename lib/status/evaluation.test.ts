import { describe, expect, it } from "vitest";

import { evaluationStatus, testTallyOf } from "./evaluation";

/**
 * Mirrors the legacy `SolutionStatusIcon` decision tree branch by branch. Worth pinning: three of
 * these outcomes are infrastructure failure modes that cannot be produced on demand against a live
 * instance, and this dev machine cannot produce real pass/fail results at all (DEC-031), so tests
 * are the only place this logic is exercised until a cgroup v1 host is available.
 */
describe("evaluationStatus", () => {
  const evaluated = (score: number) => ({ evaluation: { score } });

  it("reports a missing submission as failed", () => {
    expect(evaluationStatus({ lastSubmission: null, maxPoints: 10 })).toBe("failed");
  });

  it("reports a submission failure as failed", () => {
    expect(evaluationStatus({ lastSubmission: { failure: {} }, maxPoints: 10 })).toBe("failed");
  });

  it("reports a submission with no evaluation yet as pending", () => {
    expect(evaluationStatus({ lastSubmission: {}, maxPoints: 10 })).toBe("pending");
  });

  it("distinguishes a compilation failure from scoring zero", () => {
    expect(
      evaluationStatus({
        lastSubmission: { evaluation: { initFailed: true, score: 0 } },
        maxPoints: 10,
      }),
    ).toBe("compilation-failed");
    expect(evaluationStatus({ lastSubmission: evaluated(0), maxPoints: 10 })).toBe("incorrect");
  });

  it("maps the score to correct / partial / incorrect", () => {
    expect(evaluationStatus({ lastSubmission: evaluated(1), maxPoints: 10 })).toBe("correct");
    expect(evaluationStatus({ lastSubmission: evaluated(0.5), maxPoints: 10 })).toBe("partial");
    expect(evaluationStatus({ lastSubmission: evaluated(0), maxPoints: 10 })).toBe("incorrect");
  });

  it("greys out a zero-point assignment unless the solution was accepted", () => {
    expect(evaluationStatus({ lastSubmission: evaluated(1), maxPoints: 0 })).toBe("not-scored");
    expect(evaluationStatus({ lastSubmission: evaluated(1), maxPoints: 0, accepted: true })).toBe(
      "correct",
    );
  });
});

describe("a data-only submission", () => {
  const collected = {
    // The judge such an exercise gets by default scores nought on purpose, so that the machine
    // awards no points for work it never read (DEC-141).
    lastSubmission: { evaluation: { initFailed: false, score: 0 } },
    maxPoints: 10,
    dataOnly: true,
  };

  it("waits for a person rather than reporting a verdict", () => {
    expect(evaluationStatus(collected)).toBe("awaiting-review");
    // And the score is not what decides it: a judge a teacher wrote may return anything.
    expect(evaluationStatus({ ...collected, lastSubmission: { evaluation: { score: 1 } } })).toBe(
      "awaiting-review",
    );
  });

  it("becomes a result once somebody has marked it", () => {
    expect(evaluationStatus({ ...collected, graded: true })).toBe("reviewed");
  });

  it("says nothing about points, even on an assignment worth none", () => {
    expect(evaluationStatus({ ...collected, maxPoints: 0 })).toBe("awaiting-review");
  });

  it("leaves every failure alone", () => {
    expect(evaluationStatus({ ...collected, lastSubmission: { failure: true } })).toBe("failed");
    expect(
      evaluationStatus({
        ...collected,
        lastSubmission: { evaluation: { initFailed: true, score: 0 } },
      }),
    ).toBe("compilation-failed");
    expect(evaluationStatus({ ...collected, lastSubmission: { evaluation: null } })).toBe(
      "pending",
    );
  });

  it("does not touch an ordinary solution", () => {
    expect(
      evaluationStatus({
        ...collected,
        dataOnly: false,
        lastSubmission: { evaluation: { score: 1 } },
      }),
    ).toBe("correct");
    expect(evaluationStatus({ ...collected, dataOnly: false })).toBe("incorrect");
  });
});

describe("testTallyOf", () => {
  it("counts a test as passed on a full score", () => {
    expect(
      testTallyOf({ evaluation: { testResults: [{ score: 1 }, { score: 0 }, { score: 0.5 }] } }),
    ).toEqual({ passed: 1, total: 3 });
  });

  it("has nothing to say where no test ran", () => {
    expect(testTallyOf({ evaluation: { testResults: [] } })).toBeNull();
    expect(testTallyOf({ evaluation: null })).toBeNull();
    expect(testTallyOf(null)).toBeNull();
  });

  it("is independent of the verdict -- every test can pass and the score still be zero", () => {
    const submission = { evaluation: { score: 0, testResults: [{ score: 1 }] } };
    expect(testTallyOf(submission)).toEqual({ passed: 1, total: 1 });
    expect(evaluationStatus({ lastSubmission: submission, maxPoints: 10 })).toBe("incorrect");
  });
});

describe("evaluationStatus and a teacher's own points", () => {
  const scored = (score: number) => ({ evaluation: { score, initFailed: false } });

  it("says the points are the teacher's, whatever the scoring made of it", () => {
    expect(
      evaluationStatus({ lastSubmission: scored(0), maxPoints: 10, pointsOverridden: true }),
    ).toBe("overridden");
    expect(
      evaluationStatus({ lastSubmission: scored(1), maxPoints: 10, pointsOverridden: true }),
    ).toBe("overridden");
  });

  it("leaves what happened to the run alone -- an award does not undo a compilation failure", () => {
    expect(
      evaluationStatus({
        lastSubmission: { evaluation: { score: 0, initFailed: true } },
        maxPoints: 10,
        pointsOverridden: true,
      }),
    ).toBe("compilation-failed");
    expect(evaluationStatus({ lastSubmission: null, maxPoints: 10, pointsOverridden: true })).toBe(
      "failed",
    );
  });

  it("is not triggered by a bonus, which adds to the scoring rather than replacing it", () => {
    expect(evaluationStatus({ lastSubmission: scored(1), maxPoints: 10, graded: true })).toBe(
      "correct",
    );
  });

  it("leaves a data-only submission to its own two states", () => {
    expect(
      evaluationStatus({
        lastSubmission: scored(0),
        maxPoints: 10,
        dataOnly: true,
        pointsOverridden: true,
        graded: true,
      }),
    ).toBe("reviewed");
  });
});
