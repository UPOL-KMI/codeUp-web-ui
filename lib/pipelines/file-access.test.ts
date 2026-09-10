import { describe, expect, it } from "vitest";

import { canDownloadPipelineFile } from "./file-access";

/**
 * G-015. Pinned in a unit test rather than an E2E one because **no seeded account can exercise
 * it**: a plain supervisor cannot open the pipeline edit screen at all (it gates on `update` or
 * `fork`), and the seed has no `empowered-supervisor` -- the one role that reaches the screen
 * without being a superadmin, and therefore the only one for whom this function's answer is
 * interesting. The live half that *was* checked is the consequence: core-api answers 403 to a
 * supervisor asking for the bytes while answering 200 to the same supervisor asking for the list.
 */
const file = (uploaderId: string | null) => ({ uploaderId });

describe("canDownloadPipelineFile", () => {
  it("offers the bytes to a superadmin, whoever uploaded them", () => {
    expect(canDownloadPipelineFile(file(null), "u1", "superadmin")).toBe(true);
    expect(canDownloadPipelineFile(file("someone-else"), "u1", "superadmin")).toBe(true);
  });

  it("offers them to the person who uploaded the file", () => {
    expect(canDownloadPipelineFile(file("u1"), "u1", "empowered-supervisor")).toBe(true);
  });

  it("withholds them from everybody else who may still edit the pipeline", () => {
    // The whole point of Q-026: `update` on the pipeline does not carry the bytes.
    expect(canDownloadPipelineFile(file("someone-else"), "u1", "empowered-supervisor")).toBe(false);
    expect(canDownloadPipelineFile(file("someone-else"), "u1", "supervisor")).toBe(false);
  });

  it("withholds them for a file with no uploader, which is every seeded one", () => {
    // `userId: null` on the seeded `runner.py`, confirmed against the live payload. A null
    // uploader must never match a null-ish viewer id or everybody would be its owner.
    expect(canDownloadPipelineFile(file(null), "u1", "empowered-supervisor")).toBe(false);
    expect(canDownloadPipelineFile(file(null), "", "supervisor")).toBe(false);
  });
});
