import { getTranslations } from "next-intl/server";

import type { FileContent, SolutionFileEntry } from "@/lib/api/solution-files";
import type { ReviewComment } from "@/lib/api/solution-review";
import { highlightToLines } from "@/lib/code/highlight";
import { languageForFilename } from "@/lib/code/languages";

import { CodeBlock, CodeLine } from "@/components/code/code-block";
import { ReviewableCode } from "@/components/solutions/reviewable-code";
import { Badge } from "@/components/status/badge";

/**
 * One submitted file, rendered (S-017), with its review comments where there are any (S-018).
 *
 * Highlighting happens here, on the server, whichever viewer is used below it -- so a reader
 * without a review to take part in downloads no JavaScript for this at all, and a reviewer
 * downloads tokens rather than a highlighter. The choice between the two viewers is made on what
 * the reader can actually do: the interactive one only where there is something to interact with.
 *
 * Anchors are prefixed per file (`main-c-L12`), because several files share one page and `#L12`
 * can only mean one of them.
 */
export function fileAnchorId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Everything the reviewable variant of this file needs, and nothing a plain reading of it does. */
export interface SourceFileReview {
  comments: ReviewComment[];
  /** Each comment's markdown, rendered on the server -- see `review-comment.tsx` (G-027). */
  bodies: Record<string, React.ReactNode>;
  canComment: boolean;
  canModerate: boolean;
  currentUserId: string;
  reviewClosed: boolean;
}

export interface SourceFileProps {
  solutionId: string;
  file: SolutionFileEntry;
  /** Null when core-api could not produce the content -- the file is still listed, with the reason. */
  content: FileContent | null;
  contentError?: string;
  /**
   * Omitted where the file has no review and never will: a **reference** solution's (G-013), which
   * core-api gives no review of at all. The alternative was six dummy props at that call site.
   */
  review?: SourceFileReview;
}

export async function SourceFile({
  solutionId,
  file,
  content,
  contentError,
  review,
}: SourceFileProps) {
  const [t, code] = await Promise.all([getTranslations("Sources"), getTranslations("Code")]);
  const anchor = fileAnchorId(file.name);
  const language = languageForFilename(file.entry ?? file.name);

  const caption = (
    <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted px-4 py-2">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-foreground">{file.name}</span>
        {file.isEntryPoint && <Badge tone="info">{t("entryPoint")}</Badge>}
      </span>
      <span className="text-sm text-muted-foreground">{t("bytes", { size: file.size })}</span>
    </figcaption>
  );

  if (content === null) {
    return (
      <figure id={anchor} className="flex flex-col overflow-hidden rounded-lg border border-border">
        {caption}
        <p className="px-4 py-3 text-sm text-muted-foreground">
          {contentError ?? t("contentUnavailable")}
        </p>
      </figure>
    );
  }

  const { lines, palette, rootStyle, highlighted } = await highlightToLines(
    content.content,
    language,
  );
  const interactive = review !== undefined && (review.canComment || review.comments.length > 0);

  return (
    <figure id={anchor} className="flex flex-col overflow-hidden rounded-lg border border-border">
      {caption}
      {content.malformedCharacters && (
        <p className="border-b border-border bg-warning/10 px-4 py-2 text-sm">{t("malformed")}</p>
      )}
      {content.tooLarge && (
        <p className="border-b border-border bg-warning/10 px-4 py-2 text-sm">{t("truncated")}</p>
      )}
      {!highlighted && (
        <p className="border-b border-border px-4 py-2 text-sm text-muted-foreground">
          {code("notHighlighted")}
        </p>
      )}
      {interactive ? (
        <ReviewableCode
          solutionId={solutionId}
          fileName={file.name}
          lines={lines}
          palette={palette}
          rootStyle={rootStyle}
          idPrefix={`${anchor}-`}
          comments={review.comments}
          bodies={review.bodies}
          canComment={review.canComment}
          canModerate={review.canModerate}
          currentUserId={review.currentUserId}
          reviewClosed={review.reviewClosed}
        />
      ) : (
        <CodeBlock rootStyle={rootStyle} palette={palette}>
          {lines.map((tokens, index) => (
            <CodeLine
              key={index}
              tokens={tokens}
              palette={palette}
              number={index + 1}
              idPrefix={`${anchor}-`}
              label={code("lineLabel", { line: index + 1 })}
            />
          ))}
        </CodeBlock>
      )}
    </figure>
  );
}
