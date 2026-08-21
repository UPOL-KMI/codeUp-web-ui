import { visit } from "unist-util-visit";
import type { Root } from "mdast";
import type { Plugin } from "unified";

/**
 * Remark plugins that make the new markdown pipeline behave like the one the exercise texts in
 * the database were actually authored against (D-010).
 *
 * Brief §7 is explicit that this is not a free swap: those texts were written for `markdown-it` +
 * `@iktakahiro/markdown-it-katex`, and it asks for the differences to be found by rendering real
 * samples both ways rather than discovered during parity sweep. That comparison was run (16
 * constructs, 10 differed); these two plugins close the differences that would corrupt or lose
 * existing content. The remaining differences are additive and are recorded in DEC-055.
 */

/**
 * markdown-it runs with `html: false` here (the legacy widget passes no options), which **escapes
 * and displays** raw HTML rather than rendering it. react-markdown's default is different in a
 * way that matters: without `rehype-raw` it *drops* raw HTML nodes entirely -- `<div
 * class="note">Read <b>carefully</b>.</div>` renders as nothing at all, and an inline `<kbd>Enter
 * </kbd>` renders as the bare word "Enter". That is silent content loss in authored material.
 *
 * Converting the raw nodes to text reproduces the legacy behaviour exactly. Note this is *safer*
 * than `rehype-raw`, not just more compatible: `rehype-raw` would start executing markup that the
 * legacy app has always shown as inert text, which would be a new injection surface in
 * supervisor-authored content, reached by every student who opens the assignment.
 */
export const remarkEscapeRawHtml: Plugin<[], Root> = () => (tree) => {
  visit(tree, "html", (node, index, parent) => {
    if (!parent || index === undefined) return;
    parent.children[index] = { type: "text", value: node.value };
  });
};

/**
 * `remark-math` recognises `$...$` far more eagerly than `@iktakahiro/markdown-it-katex` does, and
 * the difference is not academic. Verified against the legacy renderer:
 *
 * | source                     | legacy | remark-math (unpatched) |
 * | -------------------------- | ------ | ----------------------- |
 * | `$x$`                      | inline | inline                  |
 * | `$ x $`                    | text   | inline                  |
 * | `It costs $5 and $10`      | text   | **inline math**         |
 * | `$$x$$` alone in the line  | block  | inline                  |
 * | `text $$x$$ text`          | text   | inline                  |
 *
 * The third row is the dangerous one: any exercise text quoting two prices currently renders as
 * prose and would silently turn into garbled mathematics. The rules legacy actually applies are
 * (a) no whitespace immediately inside the delimiters, and (b) `$$` is display math only when it
 * stands alone, otherwise it is literal text. Both are reproduced here by inspecting the original
 * source span of each node remark-math produced, which is cheaper and far more predictable than
 * writing a competing micromark extension.
 */
export const remarkLegacyMathDelimiters: Plugin<[], Root> = () => (tree, file) => {
  const source = String(file.value);
  const rawOf = (node: { position?: { start: { offset?: number }; end: { offset?: number } } }) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    return start === undefined || end === undefined ? null : source.slice(start, end);
  };

  // A paragraph that is nothing but `$$...$$` becomes display math. Done by re-labelling the node
  // remark-math already produced rather than by swapping in a block-level `math` node: remark-math
  // attaches the `data.hName`/`hProperties` that drive the mdast→hast conversion at parse time, so
  // a hand-built `math` node arrives with none of them and renders as nothing recognisable --
  // which is exactly what the unit test caught. `rehype-katex` keys display mode off the
  // `math-display` class (confirmed in its own `lib/index.js`), so flipping that class is the
  // whole change. Leaving it inside the paragraph also matches legacy, which wraps display math in
  // a `<p class="katex-block">`.
  visit(tree, "paragraph", (node) => {
    if (node.children.length !== 1) return;

    const only = node.children[0]!;
    if (only.type !== "inlineMath") return;
    if (!rawOf(only)?.startsWith("$$")) return;

    const data = (only.data ??= {});
    data.hName = "div";
    data.hProperties = { className: ["language-math", "math-display"] };
  });

  visit(tree, "inlineMath", (node, index, parent) => {
    if (!parent || index === undefined) return;

    const raw = rawOf(node);
    if (!raw) return;

    // `$$...$$` that survived the pass above is `$$` used mid-sentence, which legacy renders as
    // literal text rather than as mathematics. The `math-display` check is what keeps this pass
    // from immediately undoing the display-math re-labelling done above -- the two visitors match
    // the same nodes, and without it the first pass's work is silently reverted.
    const className = node.data?.hProperties?.className;
    const isDisplay = Array.isArray(className) && className.includes("math-display");
    if (isDisplay) return;

    if (raw.startsWith("$$")) {
      parent.children[index] = { type: "text", value: raw };
      return;
    }

    // Whitespace immediately inside the delimiters disqualifies it. Tested against the *raw*
    // source rather than `node.value`, because remark-math has already trimmed the value by this
    // point -- so `$ x $` looks identical to `$x$` if you only inspect the node, which is exactly
    // the bug the unit test caught.
    const inner = raw.slice(1, -1);
    if (/^\s|\s$/.test(inner)) {
      parent.children[index] = { type: "text", value: raw };
    }
  });
};
