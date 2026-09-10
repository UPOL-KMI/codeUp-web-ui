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
 * One coloured run of text: its content, and -- where it has a colour of its own -- an index into
 * the block's `palette`.
 *
 * **A tuple rather than an object, and an index rather than the style itself. That is PF-003.**
 * Shiki stamps a fresh `{--shiki-light, --shiki-dark}` object on every token, and the viewers hand
 * the whole array to a client island, so every one of those objects shipped twice: once as an
 * attribute in the SSR HTML and again as props JSON. Measured on this repo's own
 * `lib/exercise-config/simple-config.ts` (17,855 bytes, 500 lines): **2,084 tokens, 176,899 bytes
 * of props JSON -- 9.9x the source -- against seven distinct styles in the whole file.**
 *
 * Interning the styles alone brings that to 70,987 bytes (60%); interning them *and* dropping the
 * two repeated JSON keys brings it to **33,475 bytes, an 81% cut**. Both halves were measured
 * rather than assumed, and it is the second half that gets from 60% to the number this ticket was
 * filed with -- `"content"` and `"style"`, 2,084 times each, are most of what is left once the
 * colours are shared.
 */
export type CodeToken = [content: string] | [content: string, style: number];

export interface HighlightedCode {
  /** One entry per source line, each already split into coloured tokens. */
  lines: CodeToken[][];
  /**
   * The distinct token styles this block uses, in first-seen order (PF-003). Each is the
   * `--shiki-light` / `--shiki-dark` pair `app/globals.css` picks one of per theme; a token names
   * one by index.
   */
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

  // Interned by the declarations themselves rather than by object identity: Shiki builds a new
  // object per token, so identity says nothing about whether two tokens look the same. A whole
  // file's worth of tokens collapses to the handful of colours its grammar actually produces.
  const palette: Record<string, string>[] = [];
  const seen = new Map<string, number>();
  const styleIndex = (declarations: Record<string, string> | undefined): number | undefined => {
    if (declarations === undefined) return undefined;
    const key = JSON.stringify(declarations);
    const existing = seen.get(key);
    if (existing !== undefined) return existing;
    seen.set(key, palette.length);
    palette.push(declarations);
    return palette.length - 1;
  };

  const lines: CodeToken[][] = result.tokens.map((line) =>
    line.map((token) => {
      const style = styleIndex(token.htmlStyle);
      return style === undefined ? [token.content] : [token.content, style];
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
