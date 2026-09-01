import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Both locales are complete, and every key a screen asks for exists (brief hard constraint 6:
 * "Czech and English, both complete, always").
 *
 * Written after a live check found `Profile.groupSolutions` rendering **as its own key** on the
 * profile page -- a string used in code and added to neither locale. next-intl does not throw for
 * that in a production build; it prints the path, which reads like a placeholder somebody meant to
 * fill in and is easy to miss in review. Nothing in `typecheck`, `lint` or `build` catches it,
 * because message keys are strings.
 *
 * The scan is deliberately **forgiving about which** namespace a key belongs to: a file that binds
 * more than one (`const [t, tPoints] = await Promise.all([...])`, the shape most pages here use)
 * cannot be attributed positionally without parsing TypeScript, so a key is accepted if it
 * resolves under any namespace that file names. It still catches the case that matters -- a key
 * that exists nowhere -- without ever failing for a reason that is not real.
 */
const LOCALES = ["en", "cs"] as const;
const ROOTS = ["app", "components", "lib"];

type Messages = Record<string, unknown>;

function load(locale: string): Messages {
  return JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"));
}

function flatten(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) return [prefix];
  return Object.entries(node as Messages).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}.${key}` : key),
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** `getTranslations("X")`, `useTranslations("X")` and `getTranslations({ ..., namespace: "X" })`. */
const NAMESPACE = /(?:get|use)Translations\(\s*(?:"([^"]+)"|\{[^}]*namespace:\s*"([^"]+)")/g;
/** A call on a binding named `t`, `tStatus`, ... with a literal first argument. */
const KEY = /\bt(?:[A-Z]\w*)?\(\s*"([^"]+)"/g;

describe("messages", () => {
  const byLocale = Object.fromEntries(LOCALES.map((locale) => [locale, load(locale)]));

  it("hold the same keys in both locales", () => {
    const [first, ...rest] = LOCALES;
    const expected = flatten(byLocale[first!]).sort();
    for (const locale of rest) {
      expect(flatten(byLocale[locale]).sort(), `${locale}.json`).toEqual(expected);
    }
  });

  it("cover every key the source asks for", () => {
    const known = Object.fromEntries(
      LOCALES.map((locale) => [locale, new Set(flatten(byLocale[locale]))]),
    );
    const missing: string[] = [];

    for (const file of ROOTS.flatMap((root) => sourceFiles(join(process.cwd(), root)))) {
      const source = readFileSync(file, "utf8");
      const namespaces = [...source.matchAll(NAMESPACE)].map((match) => match[1] ?? match[2]!);
      if (namespaces.length === 0) continue;

      for (const [, key] of source.matchAll(KEY)) {
        for (const locale of LOCALES) {
          const resolves = namespaces.some((namespace) =>
            known[locale]!.has(`${namespace}.${key}`),
          );
          if (!resolves) missing.push(`${locale}: ${key} (${file.split("/").slice(-2).join("/")})`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
