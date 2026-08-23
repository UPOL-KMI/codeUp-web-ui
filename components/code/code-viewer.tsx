import { getTranslations } from "next-intl/server";

import { highlightToLines } from "@/lib/code/highlight";
import { languageForFilename, PLAINTEXT } from "@/lib/code/languages";

import { CodeBlock, CodeLine } from "./code-block";

export interface CodeViewerProps {
  code: string;
  /** Used to pick the grammar and shown as the block's caption. */
  filename: string;
  /** Overrides the extension-derived language, for content that has no meaningful filename. */
  language?: string;
}

/**
 * Source code display with per-line anchors (D-009), for exercise attachments and anywhere else a
 * file is read without being reviewed. The solution source viewer (S-017) renders the same lines
 * through `components/solutions/source-file.tsx`, which adds the review layer.
 *
 * A Server Component: no highlighter, no grammar and no theme JSON reaches the browser (brief §4),
 * and the code is present in the initial HTML -- readable before hydration, and findable by the
 * browser's own Ctrl+F.
 */
export async function CodeViewer({ code, filename, language }: CodeViewerProps) {
  const t = await getTranslations("Code");
  const resolvedLanguage = language ?? languageForFilename(filename);
  const { lines, rootStyle, highlighted } = await highlightToLines(code, resolvedLanguage);

  return (
    <figure className="flex flex-col overflow-hidden rounded-lg border border-border">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted px-4 py-2">
        <span className="font-mono text-sm text-foreground">{filename}</span>
        <span className="text-sm text-muted-foreground">
          {highlighted ? resolvedLanguage : t("notHighlighted")}
        </span>
      </figcaption>
      <CodeBlock rootStyle={rootStyle}>
        {lines.map((tokens, index) => (
          <CodeLine
            key={index}
            tokens={tokens}
            number={index + 1}
            label={t("lineLabel", { line: index + 1 })}
          />
        ))}
      </CodeBlock>
    </figure>
  );
}

export { PLAINTEXT };
