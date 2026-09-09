import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ENVIRONMENTS_WITH_EXIT_CODE_NAMES,
  EXIT_CODE_UNKNOWN,
  exitCodeMessageKey,
} from "./exit-code";

/**
 * The keys this table produces are built at render time, so `messages.test.ts`'s scan -- which
 * reads literal keys out of the source -- cannot see them. This is the same guard for the one
 * place in the app where the key is data rather than text: a code named here and missing from a
 * locale would render as its own path on a student's screen.
 */
const LOCALES = ["en", "cs"] as const;

function messages(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"));
}

function lookup(root: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[key]
          : undefined,
      root,
    );
}

describe("exitCodeMessageKey", () => {
  it("names every code it claims to know, in both locales", () => {
    for (const locale of LOCALES) {
      const root = messages(locale).Solution as Record<string, unknown>;
      const evaluation = root.evaluation as Record<string, unknown>;

      for (const [environment, codes] of ENVIRONMENTS_WITH_EXIT_CODE_NAMES) {
        for (const code of codes) {
          const key = exitCodeMessageKey(environment, code);
          expect(key, `${environment} ${code}`).not.toBeNull();
          expect(lookup(evaluation, key!), `${locale}: ${key}`).toBeTypeOf("string");
        }
      }
    }
  });

  it("leaves a code it does not know to be rendered as the number it is", () => {
    expect(exitCodeMessageKey("python3", 42)).toBeNull();
    // An environment with no wrapper of its own -- the code is the operating system's.
    expect(exitCodeMessageKey("c-gcc", 1)).toBeNull();
    expect(exitCodeMessageKey("", 1)).toBeNull();
  });

  it("has a name for core-api's own 'no code was observed'", () => {
    for (const locale of LOCALES) {
      const evaluation = (messages(locale).Solution as Record<string, unknown>)
        .evaluation as Record<string, unknown>;
      const key = exitCodeMessageKey("python3", EXIT_CODE_UNKNOWN);
      expect(key).toBe("exit.unknown");
      expect(lookup(evaluation, key!)).toBeTypeOf("string");
    }
    // It is not the environment's to name: -1 means the sandbox never saw the process return.
    expect(exitCodeMessageKey("c-gcc", EXIT_CODE_UNKNOWN)).toBe("exit.unknown");
  });
});
