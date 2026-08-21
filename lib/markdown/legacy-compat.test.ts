import { describe, expect, it } from "vitest";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import { remarkEscapeRawHtml, remarkLegacyMathDelimiters } from "./legacy-compat";

/**
 * Pins the behaviours D-010's legacy comparison identified as content-breaking. Every expectation
 * here was measured against the renderer the exercise texts in the database were authored for
 * (`markdown-it` + `@iktakahiro/markdown-it-katex`, run side by side over a 16-construct corpus),
 * not chosen from taste -- so a future dependency bump that quietly changes one of them fails here
 * instead of silently garbling somebody's assignment text.
 *
 * Mirrors `components/markdown/markdown.tsx`'s plugin order exactly, minus the Shiki step (which
 * is asynchronous and irrelevant to these rules).
 */
const render = async (source: string): Promise<string> =>
  String(
    await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkLegacyMathDelimiters)
      .use(remarkEscapeRawHtml)
      .use(remarkRehype)
      .use(rehypeKatex)
      .use(rehypeStringify)
      .process(source),
  );

const isMath = (html: string) => html.includes("katex");
const isDisplayMath = (html: string) => html.includes('display="block"');

describe("raw HTML is escaped and shown, as markdown-it's html:false does", () => {
  it("keeps a raw HTML block visible as text instead of dropping it", async () => {
    const html = await render('<div class="note">Read <b>carefully</b>.</div>');
    // The characters must survive; react-markdown's default would render nothing at all here.
    expect(html).toContain("Read");
    expect(html).toContain("carefully");
    expect(html).not.toContain("<div class=");
  });

  it("keeps inline tags visible rather than silently unwrapping them", async () => {
    const html = await render("Press <kbd>Enter</kbd> to submit.");
    expect(html).toContain("kbd");
    expect(html).not.toContain("<kbd>");
  });
});

describe("KaTeX delimiters follow the legacy rules", () => {
  it("treats tight $...$ as inline math", async () => {
    expect(isMath(await render("The complexity is $O(n)$ here."))).toBe(true);
  });

  it("does not treat $ with inner whitespace as math", async () => {
    expect(isMath(await render("$ x $"))).toBe(false);
  });

  it("leaves prices alone -- the case that would corrupt real exercise texts", async () => {
    const html = await render("It costs $5 and $10 respectively.");
    expect(isMath(html)).toBe(false);
    expect(html).toContain("$5 and $10");
  });

  it("renders $$...$$ alone in a paragraph as display math", async () => {
    expect(isDisplayMath(await render("$$\\sum_{i=1}^{n} i$$"))).toBe(true);
  });

  it("leaves $$...$$ inside a sentence as literal text", async () => {
    const html = await render("text $$x$$ text");
    expect(isMath(html)).toBe(false);
    expect(html).toContain("$$x$$");
  });
});
