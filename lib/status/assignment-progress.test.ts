import { describe, expect, it } from "vitest";

import { assignmentProgress } from "./assignment-progress";

describe("assignmentProgress", () => {
  it("reports no status at all as not submitted", () => {
    expect(assignmentProgress({ status: null, gained: null, total: 10 })).toBe("not-submitted");
  });

  it("reports a queued or running evaluation as pending", () => {
    expect(assignmentProgress({ status: "work-in-progress", gained: null, total: 10 })).toBe(
      "pending",
    );
  });

  it("reports an infrastructure failure as failed", () => {
    expect(assignmentProgress({ status: "evaluation-failed", gained: null, total: 10 })).toBe(
      "failed",
    );
  });

  it("reports a full score as correct", () => {
    expect(assignmentProgress({ status: "done", gained: 10, total: 10 })).toBe("correct");
  });

  it("reports a partial score as partial", () => {
    expect(assignmentProgress({ status: "done", gained: 4, total: 10 })).toBe("partial");
  });

  it("reports a scored solution worth no points as incorrect", () => {
    expect(assignmentProgress({ status: "failed", gained: 0, total: 10 })).toBe("incorrect");
  });

  it("does not treat a zero-point assignment as a failure", () => {
    expect(assignmentProgress({ status: "failed", gained: 0, total: 0 })).toBe("not-scored");
    expect(assignmentProgress({ status: "done", gained: 0, total: 0 })).toBe("not-scored");
  });

  it("scores an accepted solution on a zero-point assignment normally", () => {
    expect(assignmentProgress({ status: "done", gained: 0, total: 0, accepted: true })).toBe(
      "correct",
    );
  });

  it("counts bonus-inflated points as correct rather than overflowing", () => {
    expect(assignmentProgress({ status: "done", gained: 12, total: 10 })).toBe("correct");
  });

  it("treats a done status with unknown points as partial rather than correct", () => {
    expect(assignmentProgress({ status: "done", gained: null, total: 10 })).toBe("partial");
  });

  it("waits for a person on a data-only assignment, and reports their verdict once it exists", () => {
    // The pipeline's nought is not a wrong answer here: nothing was judged (DEC-141).
    expect(assignmentProgress({ status: "failed", gained: 0, total: 10, dataOnly: true })).toBe(
      "awaiting-review",
    );
    expect(
      assignmentProgress({ status: "done", gained: 7, total: 10, dataOnly: true, graded: true }),
    ).toBe("reviewed");
    // And an ordinary assignment is untouched by any of it.
    expect(assignmentProgress({ status: "failed", gained: 0, total: 10 })).toBe("incorrect");
  });
});
