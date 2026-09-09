/**
 * Derives, for every route, the message namespaces its **client** subtree asks for, and writes
 * `lib/i18n-text/route-messages.generated.ts` (PF-001).
 *
 * `<NextIntlClientProvider>` with no `messages` ships the entire catalogue to every page --
 * 126,514 bytes of it, most of which no client component on that page can reach. Trimming it needs
 * a per-route answer, and the only honest source for that answer is the import graph: which
 * `"use client"` modules a route actually pulls in, and which namespaces those ask for.
 *
 * Written as a generator rather than as a hand-kept list because a hand-kept one drifts silently:
 * a missed namespace is a **runtime** `MISSING_MESSAGE` on one screen, which neither `typecheck`
 * nor `build` sees. `lib/i18n-text/route-messages.test.ts` re-runs this and fails if the committed
 * file is stale, so the drift becomes a red test instead.
 *
 * Run with `pnpm generate:route-messages`.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";

import { format, resolveConfig } from "prettier";

const ROOT = process.cwd();
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

/** Files that can render on *any* route, so whatever they need belongs in every set. */
const UBIQUITOUS = [
  "app/[locale]/layout.tsx",
  "app/[locale]/error.tsx",
  "app/[locale]/not-found.tsx",
  "app/[locale]/forbidden.tsx",
  "app/[locale]/unauthorized.tsx",
  "app/global-not-found.tsx",
];

const sources = new Map<string, string>();

function read(path: string): string {
  const cached = sources.get(path);
  if (cached !== undefined) return cached;
  const text = readFileSync(path, "utf8");
  sources.set(path, text);
  return text;
}

function exists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function resolveImport(spec: string, importer: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = normalize(join(dirname(importer), spec));
  else return null; // a package: it carries no message namespace of this app's

  for (const candidate of [
    ...EXTENSIONS.map((extension) => base + extension),
    ...EXTENSIONS.map((extension) => join(base, `index${extension}`)),
  ]) {
    if (exists(candidate)) return candidate;
  }
  return null;
}

function isClient(path: string): boolean {
  const head = read(path).trimStart();
  return head.startsWith('"use client"') || head.startsWith("'use client'");
}

function importsOf(path: string): string[] {
  const source = read(path);
  const specs = [
    ...source.matchAll(/from\s+"([^"]+)"/g),
    ...source.matchAll(/import\("([^"]+)"\)/g),
  ].map((match) => match[1]!);
  return specs
    .map((spec) => resolveImport(spec, path))
    .filter((resolved): resolved is string => resolved !== null);
}

function namespacesIn(path: string): string[] {
  return [...read(path).matchAll(/useTranslations\(\s*"([^"]+)"/g)].map((match) => match[1]!);
}

/**
 * Every namespace reachable in the client half of `entry`'s import graph.
 *
 * The walk carries an "inside a client module" flag rather than stopping at the boundary: a client
 * component's own imports are client too, and their `useTranslations` calls are just as real.
 * A module reached from both halves is visited once per flag, which is why the seen-set is keyed
 * on the pair.
 */
function clientNamespaces(entry: string): Set<string> {
  const found = new Set<string>();
  const seen = new Set<string>();
  const stack: [string, boolean][] = [[entry, isClient(entry)]];

  while (stack.length > 0) {
    const [path, inside] = stack.pop()!;
    const key = `${inside ? "c" : "s"}:${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (inside) for (const namespace of namespacesIn(path)) found.add(namespace);
    for (const dependency of importsOf(path)) {
      stack.push([dependency, inside || isClient(dependency)]);
    }
  }
  return found;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/**
 * The URL a page file answers on, with the locale segment and the route groups removed -- the same
 * shape `proxy.ts` hands the layout, so the two can be compared without either knowing the other's
 * conventions.
 */
function routeOf(page: string): string {
  const segments = relative(join(ROOT, "app"), dirname(page))
    .split(sep)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
    .filter((segment) => segment !== "[locale]");
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

const base = new Set<string>();
for (const relativePath of UBIQUITOUS) {
  const path = join(ROOT, relativePath);
  if (exists(path)) for (const namespace of clientNamespaces(path)) base.add(namespace);
}

const pages = walk(join(ROOT, "app")).filter((path) => path.endsWith(`${sep}page.tsx`));
const routes = new Map<string, Set<string>>();

for (const page of pages) {
  const namespaces = new Set(base);
  // Every layout above this page renders around it, so its client islands are on the screen too.
  for (let dir = dirname(page); dir.startsWith(join(ROOT, "app")); dir = resolve(dir, "..")) {
    const layout = join(dir, "layout.tsx");
    if (exists(layout)) for (const namespace of clientNamespaces(layout)) namespaces.add(namespace);
  }
  for (const namespace of clientNamespaces(page)) namespaces.add(namespace);

  const route = routeOf(page);
  const existing = routes.get(route);
  if (existing) for (const namespace of namespaces) existing.add(namespace);
  else routes.set(route, namespaces);
}

const entries = [...routes.entries()].sort(([a], [b]) => a.localeCompare(b));
const body = entries
  .map(([route, namespaces]) => {
    const list = [...namespaces].sort().map((namespace) => `    ${JSON.stringify(namespace)},`);
    return `  ${JSON.stringify(route)}: [\n${list.join("\n")}\n  ],`;
  })
  .join("\n");

const shell = [...base].sort();
for (const name of ["app/[locale]/(app)/layout.tsx", "app/[locale]/(anon)/layout.tsx"]) {
  const path = join(ROOT, name);
  if (exists(path))
    for (const namespace of clientNamespaces(path))
      if (!shell.includes(namespace)) shell.push(namespace);
}
shell.sort();

const output = `// Generated by \`pnpm generate:route-messages\` (PF-001). Do not edit by hand --
// \`lib/i18n-text/route-messages.test.ts\` regenerates this and fails when it is stale.
//
// Each route maps to the message namespaces its client subtree asks for, plus those of every
// layout above it and of the error/not-found pages, which can render anywhere.

/** What renders *outside* any page -- the shells and the error pages -- and so belongs to the
 *  provider in \`app/[locale]/layout.tsx\`, which a client-side navigation does not re-render. */
export const SHELL_MESSAGE_NAMESPACES: readonly string[] = [
${shell.map((namespace) => `  ${JSON.stringify(namespace)},`).join("\n")}
];

export const ROUTE_MESSAGE_NAMESPACES: Record<string, readonly string[]> = {
${body}
};
`;

const target = join(ROOT, "lib", "i18n-text", "route-messages.generated.ts");
// Formatted the way the repo's other generated file is, so `format:check` stays green and the
// `--check` comparison below is against the same text a developer would see after `format`.
const formatted = await format(output, {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (process.argv.includes("--check")) {
  const current = exists(target) ? readFileSync(target, "utf8") : "";
  if (current !== formatted) {
    console.error("route-messages.generated.ts is stale; run `pnpm generate:route-messages`.");
    process.exit(1);
  }
  console.log(`route-messages.generated.ts is current (${entries.length} routes).`);
} else {
  writeFileSync(target, formatted);
  console.log(`Wrote ${entries.length} routes to lib/i18n-text/route-messages.generated.ts`);
}
