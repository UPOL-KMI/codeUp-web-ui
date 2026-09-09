import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ROUTE_MESSAGE_NAMESPACES } from "./route-messages.generated";
import { namespacesForRoute, pickMessages } from "./route-messages";

/**
 * The guard PF-001 needs (and the reason the map is generated rather than written).
 *
 * A namespace a route needs and does not get is a **runtime** `MISSING_MESSAGE` on one screen --
 * `typecheck` cannot see a string and `build` renders no page. So the map is derived from the
 * import graph, and this re-derives it: a component that starts using a namespace, or a page that
 * starts rendering that component, turns into a failing test rather than a broken screen.
 */
describe("the generated route map", () => {
  it("is current with the source it was derived from", () => {
    // The script's own `--check`: it re-derives and compares rather than writing.
    expect(() =>
      execFileSync(join(process.cwd(), "node_modules", ".bin", "tsx"), [
        "scripts/route-messages.ts",
        "--check",
      ]),
    ).not.toThrow();
  });

  it("gives every route the namespaces that can render on any of them", () => {
    // `error.tsx` and the toast provider are mounted everywhere; a route missing them would fail
    // exactly when something went wrong, which is the worst time to lose the words for it.
    for (const [route, namespaces] of Object.entries(ROUTE_MESSAGE_NAMESPACES)) {
      expect(namespaces, route).toContain("Error");
      expect(namespaces, route).toContain("Toast");
    }
  });
});

describe("namespacesForRoute", () => {
  it("matches a static route exactly", () => {
    expect(namespacesForRoute("/dashboard")).toBe(ROUTE_MESSAGE_NAMESPACES["/dashboard"]);
  });

  it("matches a route with dynamic segments", () => {
    expect(namespacesForRoute("/solutions/4c4ee6d7-bb33-47f6-b871-30ecea2278e2")).toBe(
      ROUTE_MESSAGE_NAMESPACES["/solutions/[solutionId]"],
    );
  });

  it("falls back to everything rather than to nothing", () => {
    // An unmatched path is then as heavy as it was before PF-001, never missing its words.
    expect(namespacesForRoute("/not/a/route/this/app/has")).toBeNull();
    expect(namespacesForRoute(null)).toBeNull();
  });

  it("does not match a path of a different length", () => {
    expect(namespacesForRoute("/solutions")).toBeNull();
  });
});

describe("pickMessages", () => {
  const catalogue = {
    Nav: { primary: "Primary", locale: { label: "Language" } },
    Solution: { title: "Solution", evaluation: { heading: "Evaluation" } },
    Unused: { anything: "no" },
  };

  it("takes whole namespaces and dotted ones alike", () => {
    expect(pickMessages(catalogue, ["Nav.locale", "Solution.evaluation"])).toEqual({
      Nav: { locale: { label: "Language" } },
      Solution: { evaluation: { heading: "Evaluation" } },
    });
  });

  it("leaves out what was not asked for", () => {
    expect(pickMessages(catalogue, ["Nav"])).toEqual({ Nav: catalogue.Nav });
  });

  it("keeps the wider branch when a namespace and its parent are both asked for", () => {
    // Order must not decide the result: `Solution` covers `Solution.evaluation` either way.
    expect(pickMessages(catalogue, ["Solution.evaluation", "Solution"])).toEqual({
      Solution: catalogue.Solution,
    });
    expect(pickMessages(catalogue, ["Solution", "Solution.evaluation"])).toEqual({
      Solution: catalogue.Solution,
    });
  });

  it("skips a namespace the catalogue does not have rather than throwing", () => {
    // `messages.test.ts` is what notices a missing string; a blank page here would be worse.
    expect(pickMessages(catalogue, ["Nope", "Nav.locale"])).toEqual({
      Nav: { locale: { label: "Language" } },
    });
  });
});

describe("the real catalogue", () => {
  it("resolves every namespace the map names, in both locales", () => {
    const routes = Object.values(ROUTE_MESSAGE_NAMESPACES).flat();
    for (const locale of ["en", "cs"]) {
      const messages = JSON.parse(
        readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"),
      ) as Record<string, unknown>;
      const picked = pickMessages(messages, routes);
      for (const namespace of routes) {
        const resolved = namespace
          .split(".")
          .reduce<unknown>(
            (node, part) =>
              typeof node === "object" && node !== null
                ? (node as Record<string, unknown>)[part]
                : undefined,
            picked,
          );
        expect(resolved, `${locale}: ${namespace}`).toBeDefined();
      }
    }
  });
});
