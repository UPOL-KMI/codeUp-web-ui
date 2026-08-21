import { describe, expect, it } from "vitest";

import { evaluationStatus } from "./evaluation";

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
