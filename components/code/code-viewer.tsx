import { getTranslations } from "next-intl/server";

import { highlightCode } from "@/lib/code/highlight";
import { languageForFilename, PLAINTEXT } from "@/lib/code/languages";

export interface CodeViewerProps {
  code: string;
  /** Used to pick the grammar and shown as the block's caption. */
  filename: string;
  /** Overrides the extension-derived language, for content that has no meaningful filename. */
  language?: string;
}

/**
 * Source code display with per-line anchors (D-009), for solution files, exercise attachments and
 * anywhere else a submitted file is read.
 *
 * A Server Component that renders already-highlighted HTML: no highlighter, no grammar and no
 * theme JSON reaches the browser (brief §4). That also means the code is present in the initial
 * HTML -- readable before hydration, and findable by the browser's own Ctrl+F.
 *
 * `dangerouslySetInnerHTML` is Shiki's intended interface and is safe here for a specific reason,
 * not by assumption: the input is tokenised text, and every token is emitted as an escaped text
 * node inside a `<span>` -- Shiki never interprets the source as markup, so a solution file
 * containing `<script>` renders as the characters `<script>`. The `<a>` elements this app adds
 * come from its own transformer, not from the file.
 *
 * What this deliberately does *not* do yet: per-line review comments and collapsed unchanged
 * regions, both of which the legacy viewer has (`SourceCodeViewer.js`). Those belong to the
 * solution-review ticket, and the `id`/`data-line` attributes here are exactly the hook it will
 * need -- built now because line anchoring is this ticket, not because that ticket is being
 * started early.
 */
export async function CodeViewer({ code, filename, language }: CodeViewerProps) {
  const t = await getTranslations("Code");
  const resolvedLanguage = language ?? languageForFilename(filename);
  const { html, highlighted } = await highlightCode(code, resolvedLanguage, (line) =>
    t("lineLabel", { line }),
  );

  return (
    <figure className="flex flex-col overflow-hidden rounded-lg border border-border">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted px-4 py-2">
        <span className="font-mono text-sm text-foreground">{filename}</span>
        <span className="text-sm text-muted-foreground">
          {highlighted ? resolvedLanguage : t("notHighlighted")}
        </span>
      </figcaption>
      <div
        data-slot="code-block"
        className="overflow-x-auto text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}

export { PLAINTEXT };
