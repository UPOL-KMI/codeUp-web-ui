/**
 * File extension → Shiki language id (D-009).
 *
 * Ported from the legacy app's own `src/components/helpers/syntaxHighlighting.js` rather than
 * invented: students upload files with these extensions today, and a mapping that disagrees with
 * the one they are used to would silently change how their own solutions look. The legacy table is
 * Prism-flavoured, so the ids are translated where the two highlighters disagree (`markup` →
 * `html`/`xml`, `c_cpp` → `c`/`cpp`, `bison` dropped -- Shiki has no grammar for it).
 *
 * Anything unmapped falls back to `plaintext`: a wrong grammar produces confidently-wrong
 * colouring, which is worse than none at all when a student is looking for a bug.
 */
export const PLAINTEXT = "plaintext";

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  bash: "bash",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  css: "css",
  cu: "cpp", // CUDA -- legacy maps it to cpp too
  go: "go",
  groovy: "groovy",
  h: "c",
  hpp: "cpp",
  hs: "haskell",
  html: "html",
  ino: "cpp", // Arduino sketches are C++
  java: "java",
  js: "javascript",
  json: "json",
  kt: "kotlin",
  kts: "kotlin",
  ktm: "kotlin",
  lpr: "pascal",
  makefile: "make",
  md: "markdown",
  markdown: "markdown",
  pas: "pascal",
  php: "php",
  pl: "prolog",
  py: "python",
  rs: "rust",
  sc: "scala",
  scala: "scala",
  sh: "bash",
  sql: "sql",
  svg: "xml",
  ts: "typescript",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
};

/** Every language this app loads a grammar for -- see `lib/code/highlight.ts`. */
export const SUPPORTED_LANGUAGES = [...new Set(Object.values(EXTENSION_TO_LANGUAGE))];

/**
 * `Makefile` has no extension at all, which the legacy helper handles explicitly; the same case
 * is handled here rather than left to the fallback, since a Makefile is common in submitted
 * archives.
 */
export function languageForFilename(filename: string): string {
  const name = filename.trim().toLowerCase();
  if (name === "makefile" || name === "gnumakefile") return "make";

  const lastDot = name.lastIndexOf(".");
  const extension = lastDot === -1 ? "" : name.slice(lastDot + 1);
  return EXTENSION_TO_LANGUAGE[extension] ?? PLAINTEXT;
}
