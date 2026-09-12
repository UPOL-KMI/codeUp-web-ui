import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A wall-clock string is resolved in the browser, never in a Server Action.
 *
 * Written after a live run against the deployment found every date typed into a form landing two
 * hours out: the container runs UTC, the reader's browser runs Europe/Prague, and
 * `new Date("2026-09-12T06:41")` means whatever zone the process is in. Assignment deadlines,
 * system-message windows, invitation expiries and shadow points were all converted in the action.
 *
 * Nothing else catches it. Both sides typecheck, both build, and the e2e suite ran against a local
 * `next start` whose zone matched the browser's -- so the two errors cancelled and the suite was
 * green. It only reproduces where the server's zone differs from the reader's, which is every real
 * deployment and no development machine.
 *
 * So the rule is structural rather than per-call-site: a `"use server"` module may not reach for
 * the conversion at all. Forms convert with `fromDateTimeLocal` and hand the action unix seconds,
 * which are the same instant in every zone.
 */
const ROOTS = ["lib", "app"];
const FORBIDDEN = ["fromDateTimeLocal", "Date.parse("];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [path] : [];
  });
}

function isServerModule(source: string): boolean {
  return /^\s*["']use server["'];/.test(source);
}

describe("the datetime-local boundary", () => {
  it("is crossed in the browser: no Server Action resolves a wall-clock string", () => {
    const offenders = ROOTS.flatMap(sourceFiles)
      .map((path) => ({ path, source: readFileSync(path, "utf8") }))
      .filter(({ source }) => isServerModule(source))
      .flatMap(({ path, source }) =>
        FORBIDDEN.filter((needle) => source.includes(needle)).map(
          (needle) => `${path} uses ${needle}`,
        ),
      );

    expect(offenders).toEqual([]);
  });
});
