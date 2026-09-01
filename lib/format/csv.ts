/**
 * The one CSV writer (T-007), for the points export and anything after it.
 *
 * **Semicolons, not commas, and a byte-order mark** -- both for the same reason: the file's first
 * reader is Excel, on a machine whose list separator is `;` (the deployment's own locale, and what
 * the legacy export already produced, so a teacher's existing sheet keeps splitting into the same
 * columns). The BOM is what makes Excel read the file as UTF-8 rather than as the local code page,
 * which is the difference between `Jiří Novák` and `JiÅ™Ã­`.
 *
 * **A quote inside a field is doubled, per RFC 4180** -- not backslash-escaped, which is what the
 * legacy exporter does (`escapeString` is JavaScript string escaping applied to a CSV field). A
 * student named `O"Brien`, or an assignment called `Task "A"`, produces a file the legacy app
 * cannot round-trip and Excel splits at the wrong place; this one it reads correctly. Not
 * reproducing that bug is deliberate -- nothing downstream depends on the broken form, because
 * nothing could have parsed it.
 */
const SEPARATOR = ";";
const NEWLINE = "\r\n";
const BOM = "﻿";

export type CsvValue = string | number | null | undefined;

function field(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  return /[";\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** The rows as CSV text. No BOM -- `csvDocument` adds that, tests read this. */
export function toCsv(rows: readonly CsvValue[][]): string {
  return rows.map((row) => row.map(field).join(SEPARATOR)).join(NEWLINE);
}

/** What actually gets downloaded: the same text, with the BOM and a trailing newline. */
export function csvDocument(rows: readonly CsvValue[][]): string {
  return `${BOM}${toCsv(rows)}${NEWLINE}`;
}

/**
 * A file name safe to put in a `Content-Disposition` header and on any filesystem. Group names
 * are free text -- they contain slashes (`Intro to Programming / Lab A`), quotes and newlines --
 * and a header is exactly where an unescaped one becomes a security problem rather than an
 * inconvenience.
 */
export function csvFileName(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/["\\/:*?<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${cleaned || fallback}.csv`;
}
