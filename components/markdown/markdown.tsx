import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { getHighlighter } from "@/lib/code/highlight";
import { PLAINTEXT } from "@/lib/code/languages";
import { remarkEscapeRawHtml, remarkLegacyMathDelimiters } from "@/lib/markdown/legacy-compat";

import "katex/dist/katex.min.css";

/**
 * Renders exercise texts, assignment descriptions and any other authored markdown in the system
 * (D-010). A Server Component: the parser, KaTeX and Shiki all run on the server, and the browser
 * receives plain HTML (brief §4's "server-side" for both markdown and code display).
 *
 * **Plugin order is load-bearing.** `remarkMath` must run before `remarkLegacyMathDelimiters`,
 * which post-processes the nodes it produced; `remarkEscapeRawHtml` must run before the
 * mdast→hast conversion that would otherwise discard those nodes. See `lib/markdown/legacy-compat.ts`
 * for what each of the two compatibility plugins fixes and the measured difference behind it.
 *
 * Code fences are highlighted by Shiki rather than by the legacy app's `highlight.js`, sharing
 * D-009's highlighter instance so a fenced block in an exercise text and a submitted solution file
 * use the same grammars and themes.
 *
 * **This component is `async` for a reason that only shows up at run time.** react-markdown
 * executes its plugin pipeline **synchronously** (`runSync`), so the ordinary `@shikijs/rehype`
 * plugin -- which is asynchronous -- fails with `runSync finished async. Use run instead`. Neither
 * `typecheck` nor `build` catches it, because this route renders per request. The fix is to await
 * the highlighter here and hand the *instance* to `rehypeShikiFromHighlighter`, the synchronous
 * entry point `@shikijs/rehype/core` exists for. `dangerouslySetInnerHTML` is not involved anywhere: react-markdown
 * builds React elements, and raw HTML is turned into text before it ever reaches the renderer.
 */
export async function Markdown({ source }: { source: string }) {
  const highlighter = await getHighlighter();

  return (
    <div data-slot="markdown" className="recodex-markdown flex flex-col gap-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkLegacyMathDelimiters, remarkEscapeRawHtml]}
        rehypePlugins={[
          rehypeKatex,
          [
            rehypeShikiFromHighlighter,
            highlighter,
            {
              themes: { light: "github-light", dark: "github-dark" },
              defaultColor: false,
              // A fence with no language, or one this highlighter has no grammar loaded for, must
              // not fail the whole page -- an exercise text is authored content and will contain
              // both.
              fallbackLanguage: PLAINTEXT,
            },
          ],
        ]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
