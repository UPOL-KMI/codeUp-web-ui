import "server-only";

import { createHighlighter, type Highlighter, type ShikiTransformer } from "shiki";

import { PLAINTEXT, SUPPORTED_LANGUAGES } from "./languages";

/**
 * Server-side syntax highlighting (D-009). Brief §4's stack table: "Code display: Shiki, rendered
 * server-side" -- so no highlighter ships to the browser at all, and a solution's source arrives
 * as already-coloured HTML.
 *
 * The highlighter is created **once per server process** and reused: `createHighlighter()` loads
 * and compiles every requested TextMate grammar, which is far too expensive to repeat per request.
 * Held as the promise rather than the resolved value so concurrent first requests share one
 * initialisation instead of racing to start several.
 *
 * Grammars are restricted to `SUPPORTED_LANGUAGES` rather than using Shiki's full bundle: the full
 * bundle pulls in every grammar Shiki ships, none of which this app can encounter beyond the list
 * the legacy extension mapping actually produces.
 */
let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Exported because the markdown renderer (D-010) needs the *instance*, not just the rendered
 * output: react-markdown runs its plugin pipeline synchronously, so it cannot use the async
 * `@shikijs/rehype` plugin -- it must be handed an already-created highlighter through
 * `rehypeShikiFromHighlighter`. Sharing this one keeps markdown fences and the code viewer on the
 * same grammars, the same themes and the same single initialisation.
 */

export function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: [...SUPPORTED_LANGUAGES, PLAINTEXT],
  });
  return highlighterPromise;
}

/**
 * Above this, the file is rendered without highlighting. Uploads are allowed up to 512 MiB
 * (`lib/upload/limits.ts`) and a generated or minified file well inside that limit would tie up a
 * server process tokenising something nobody is going to read line by line. The file is still
 * shown in full -- only the colouring is skipped, and the viewer says so.
 */
export const MAX_HIGHLIGHT_BYTES = 512 * 1024;

/**
 * Gives every line a stable `id` (`L1`, `L2`, ...) and a clickable line-number anchor, which is
 * D-009's actual requirement: a review comment or a bug report has to be able to link at a
 * specific line and have that line still be that line when the page reloads.
 *
 * The anchor is a real `<a>` inside the line rather than a CSS counter, because a counter cannot
 * be linked to, focused, or opened in a new tab. It is `user-select: none` in CSS so that copying
 * the code does not carry the numbers along with it (the reason GitHub uses a separate column).
 */
function lineAnchors(lineLabel: (line: number) => string): ShikiTransformer {
  return {
    name: "recodex:line-anchors",
    line(node, line) {
      node.properties.id = `L${line}`;
      node.properties["data-line"] = line;
      node.children.unshift({
        type: "element",
        tagName: "a",
        properties: {
          href: `#L${line}`,
          className: ["code-line-number"],
          "aria-label": lineLabel(line),
        },
        children: [{ type: "text", value: String(line) }],
      });
    },
  };
}

export interface HighlightResult {
  html: string;
  /** False when the file was too large to tokenise -- the viewer surfaces this rather than hiding it. */
  highlighted: boolean;
}

export async function highlightCode(
  code: string,
  language: string,
  lineLabel: (line: number) => string,
): Promise<HighlightResult> {
  const highlighter = await getHighlighter();
  const loaded = highlighter.getLoadedLanguages();
  // An unmapped or unloaded grammar falls back to plaintext instead of throwing: a viewer that
  // errors on an unexpected file extension is worse than one that shows the file uncoloured.
  const resolved = loaded.includes(language) ? language : PLAINTEXT;
  const tooLarge = Buffer.byteLength(code, "utf8") > MAX_HIGHLIGHT_BYTES;

  const html = highlighter.codeToHtml(code, {
    lang: tooLarge ? PLAINTEXT : resolved,
    themes: { light: "github-light", dark: "github-dark" },
    // Emits `--shiki-light`/`--shiki-dark` custom properties on every span instead of a hardcoded
    // colour, so `app/globals.css` can pick one from next-themes' `.dark` class. `light-dark()`
    // was the alternative, but it keys off the CSS `color-scheme` property rather than that class,
    // so an explicitly-toggled theme would not follow it.
    defaultColor: false,
    transformers: [lineAnchors(lineLabel)],
  });

  return { html, highlighted: !tooLarge && resolved !== PLAINTEXT };
}
