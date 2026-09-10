"use server";

import { getTranslations } from "next-intl/server";

import { requireSession } from "@/lib/auth/require-session";
import type { ActionResult } from "@/lib/forms/action-result";

import { Markdown } from "@/components/markdown/markdown";

/**
 * Renders a draft through the **same** pipeline the reader will see it through (G-028), so a
 * preview cannot disagree with the thing it is previewing.
 *
 * **Why this is a Server Action returning a React node rather than an endpoint returning HTML.**
 * `Markdown` is an async Server Component that deliberately never touches
 * `dangerouslySetInnerHTML` -- it builds React elements, and raw HTML in the source is escaped to
 * text before it reaches the renderer. Rendering it to an HTML string and injecting that would
 * throw away exactly the property that makes it safe to point at authored content. React
 * serialises a node across the RSC boundary instead, which keeps one renderer, one set of KaTeX
 * delimiters and one Shiki theme for both the preview and the page. **Verified live rather than
 * assumed** -- the bundled Next docs defer to React's on what a Server Function may return, so
 * this was probed with the real component before the ticket was built (DEC-128).
 *
 * The component is **called and awaited** rather than returned as `<Markdown source={source} />`:
 * the input is arbitrary authored text on its way through a parser, and awaiting it here is what
 * allows a failure to come back as a form error instead of a rejected action.
 */
const MAX_SOURCE_LENGTH = 100_000;

export async function renderMarkdownPreview(
  source: string,
): Promise<ActionResult<React.ReactNode>> {
  // A public endpoint that runs a markdown parser, KaTeX and Shiki: cheap for a reader, worth
  // nobody's while anonymously.
  await requireSession();
  const t = await getTranslations("MarkdownPreview");

  if (typeof source !== "string") return { success: false, formError: t("failed") };
  if (source.length > MAX_SOURCE_LENGTH) return { success: false, formError: t("tooLong") };

  try {
    return { success: true, data: await Markdown({ source }) };
  } catch {
    return { success: false, formError: t("failed") };
  }
}
