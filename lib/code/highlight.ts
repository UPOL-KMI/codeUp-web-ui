import "server-only";

import { createHighlighter, type BundledLanguage, type Highlighter } from "shiki";

import { PLAINTEXT, SUPPORTED_LANGUAGES } from "./languages";

/**
 * Server-side syntax highlighting (D-009). Brief §4's stack table: "Code display: Shiki, rendered
 * server-side" -- so no highlighter ships to the browser at all, and a solution's source arrives
 * already tokenised and coloured.
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
 * One coloured run of text: the text, and an index into `HighlightedCode.palette` (PF-003).
 *
 * **A tuple rather than an object, which is PF-009 and costs a little readability at the two
 * render sites for a reason worth the trade.** These cross the RSC boundary as props for
 * `reviewable-code.tsx`, and an object repeats its own key names once per token -- `"content":`
 * and `"style":` are 21 bytes of scaffolding against 3 for `[",]`. On the 26 kB file PF-003
 * measured that is 3,055 tokens x ~19 bytes, and it was the largest thing left in the payload
 * after the palette.
 *
 * **Shiki hands back a fresh style object per token** even though a file uses a handful of
 * distinct ones -- 3,055 object identities for 8 distinct values on that same file -- so nothing
 * deduplicates by reference and the palette is what makes the index meaningful.
 */
export type CodeToken = [content: string, style?: number];

export interface HighlightedCode {
  /** One entry per source line, each already split into coloured tokens. */
  lines: CodeToken[][];
  /** The distinct token styles this file uses, indexed by `CodeToken.style` (PF-003). */
  palette: Record<string, string>[];
  /** The block's own foreground/background custom properties, for the `<pre>` element. */
  rootStyle: Record<string, string>;
  /** False when the file was too large to tokenise -- the viewer surfaces this rather than hiding it. */
  highlighted: boolean;
}

/**
 * Shiki's `rootStyle` and token styles are CSS declaration *strings*
 * (`--shiki-light:#24292e;--shiki-dark:#e1e4e8`). React's `style` prop takes an object, and it
 * does accept custom properties as keys, so the string is parsed once here rather than smuggled
 * into `dangerouslySetInnerHTML` markup on the way out.
 */
function parseStyle(declarations: string | undefined): Record<string, string> {
  const style: Record<string, string> = {};
  for (const declaration of (declarations ?? "").split(";")) {
    const separator = declaration.indexOf(":");
    if (separator === -1) continue;
    const property = declaration.slice(0, separator).trim();
    const value = declaration.slice(separator + 1).trim();
    if (property) style[property] = value;
  }
  return style;
}

/**
 * Tokens rather than Shiki's own HTML string, because the two consumers that matter need to put
 * their own elements *between* the lines: the review viewer interleaves comment threads and a
 * comment form (S-018), and it does so in a client island where a pre-rendered HTML blob could
 * only be re-parsed. Tokens are plain serialisable data, so the same highlighting crosses the RSC
 * boundary without a grammar, a theme or a highlighter following it (brief §4).
 *
 * Rendering them is `components/code/code-block.tsx`'s job; nothing here emits markup, which also
 * means React escapes every token's text as an ordinary text node -- a solution file containing
 * `<script>` renders as the characters `<script>`.
 */
export async function highlightToLines(code: string, language: string): Promise<HighlightedCode> {
  const highlighter = await getHighlighter();
  const loaded = highlighter.getLoadedLanguages();
  // An unmapped or unloaded grammar falls back to plaintext instead of throwing: a viewer that
  // errors on an unexpected file extension is worse than one that shows the file uncoloured.
  const resolved = loaded.includes(language) ? language : PLAINTEXT;
  const tooLarge = Buffer.byteLength(code, "utf8") > MAX_HIGHLIGHT_BYTES;

  const result = highlighter.codeToTokens(code, {
    // `lang` is typed against Shiki's *bundled* language union, but this highlighter loads only
    // the grammars in `SUPPORTED_LANGUAGES` and `resolved` is already checked against
    // `getLoadedLanguages()` on the line above -- the runtime check the union cannot express.
    lang: (tooLarge ? PLAINTEXT : resolved) as BundledLanguage,
    themes: { light: "github-light", dark: "github-dark" },
    // Emits `--shiki-light`/`--shiki-dark` custom properties on every token instead of a hardcoded
    // colour, so `app/globals.css` can pick one from next-themes' `.dark` class. `light-dark()`
    // was the alternative, but it keys off the CSS `color-scheme` property rather than that class,
    // so an explicitly-toggled theme would not follow it.
    defaultColor: false,
  });

  // One palette for the file, keyed by the style's own serialisation: Shiki's objects are never
  // identical by reference (see `CodeToken.style`), so value equality is what has to be tested.
  const palette: Record<string, string>[] = [];
  const paletteIndex = new Map<string, number>();
  const lines = result.tokens.map((line) =>
    line.map((token): CodeToken => {
      const style = token.htmlStyle;
      if (!style || typeof style === "string") return [token.content];
      const key = JSON.stringify(style);
      let index = paletteIndex.get(key);
      if (index === undefined) {
        index = palette.length;
        paletteIndex.set(key, index);
        palette.push(style);
      }
      return [token.content, index];
    }),
  );
  // A file ending in a newline tokenises to a final empty line, which would render as a numbered
  // line that is not in the file.
  if (lines.length > 1 && lines[lines.length - 1]!.length === 0) lines.pop();

  return {
    lines,
    palette,
    rootStyle: parseStyle(typeof result.rootStyle === "string" ? result.rootStyle : undefined),
    highlighted: !tooLarge && resolved !== PLAINTEXT,
  };
}
