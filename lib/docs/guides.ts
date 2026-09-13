import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The three guides the product ships with (X-002), and where their text comes from.
 *
 * **The text lives in this repository rather than in `messages/`.** A message catalogue is for
 * interface strings, and these are documents: a few hundred lines of prose each, with tables and
 * fenced commands in them. Putting them in JSON would mean escaping every newline and would make
 * the one thing that matters about a document -- reading it as a whole in a diff -- impossible.
 * They render through the same server-side `Markdown` component as an exercise text (DEC-139).
 *
 * **The documents start at `##`, deliberately.** `PageShell` renders the page's `h1` from the
 * message catalogue -- which is also what names the guide in the breadcrumb, the browser tab and
 * the signpost -- so a `#` at the top of the file would be a second `h1` saying the same thing,
 * and a title maintained in two places that can drift apart. An e2e spec caught exactly that.
 *
 * Read at request time rather than imported, because markdown is not a module. `next.config.ts`
 * traces `content/docs` into the standalone output for exactly that reason: nothing in the code
 * references these paths statically, so the build cannot infer them.
 */
export const GUIDE_SLUGS = ["student", "teacher", "install"] as const;

export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export function isGuideSlug(value: string): value is GuideSlug {
  return (GUIDE_SLUGS as readonly string[]).includes(value);
}

const CONTENT_ROOT = join(process.cwd(), "content", "docs");

/**
 * The guide's own text, or `null` where the file is missing -- which is a deployment fault rather
 * than a reader's, so the page says so instead of rendering an empty document.
 *
 * A locale the guide was never written in falls back to English, the same way every other
 * localized text in this app falls back rather than showing nothing.
 */
export async function getGuide(slug: GuideSlug, locale: string): Promise<string | null> {
  for (const candidate of [locale, "en"]) {
    try {
      return await readFile(join(CONTENT_ROOT, `${slug}.${candidate}.md`), "utf8");
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * In-app help: a document opened in a dialog next to the screen it explains, rather than a page of
 * its own somewhere else.
 *
 * Same reasoning as the guides above and the same machinery (DEC-139), and the same reason for
 * being files rather than message keys: the test configuration help is a few screens of prose,
 * tables and worked examples, which in JSON would be unreadable in a diff and unmaintainable as a
 * whole. `next.config.ts` traces `content/help` into the standalone output alongside `content/docs`.
 *
 * It is deliberately *not* one of the three guides: those are documents a reader goes to and reads
 * end to end, this is something read while filling a form in, and putting it in the signpost would
 * make the guides list about the product's screens rather than about its readers.
 */
const HELP_ROOT = join(process.cwd(), "content", "help");

export async function getHelp(slug: string, locale: string): Promise<string | null> {
  for (const candidate of [locale, "en"]) {
    try {
      return await readFile(join(HELP_ROOT, `${slug}.${candidate}.md`), "utf8");
    } catch {
      continue;
    }
  }
  return null;
}
