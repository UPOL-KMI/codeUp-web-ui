import type { SimilarityFragment } from "@/lib/api/plagiarism";

/**
 * A file with the passages a detection tool matched marked in it (S-019).
 *
 * The tool reports matches as **character offsets into the file**, not line numbers, so this
 * cannot go through D-009's `CodeViewer`: that one highlights whole lines, and a match that starts
 * mid-line would be widened into a claim the tool did not make. Plain text with `<mark>` on the
 * exact ranges says precisely what was reported -- at the cost of syntax colouring, which is not
 * what a reader of this screen is looking at.
 *
 * Ranges are merged before rendering: a tool may report overlapping fragments (two matches sharing
 * a passage), and nested `<mark>`s would render as darker patches that mean nothing.
 */
export interface SourceRange {
  offset: number;
  length: number;
}

export function mergeRanges(ranges: SourceRange[], contentLength: number): SourceRange[] {
  const clipped = ranges
    .map((range) => ({
      offset: Math.max(0, Math.min(range.offset, contentLength)),
      length: Math.max(0, range.length),
    }))
    .filter((range) => range.length > 0 && range.offset < contentLength)
    .sort((a, b) => a.offset - b.offset);

  const merged: SourceRange[] = [];
  for (const range of clipped) {
    const last = merged[merged.length - 1];
    if (last && range.offset <= last.offset + last.length) {
      last.length = Math.max(last.length, range.offset + range.length - last.offset);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function fragmentRanges(
  fragments: SimilarityFragment[],
  side: "tested" | "other",
): SourceRange[] {
  return fragments.map((fragment) => fragment[side]);
}

export function MarkedSource({
  content,
  ranges,
  label,
}: {
  content: string;
  ranges: SourceRange[];
  label: string;
}) {
  const merged = mergeRanges(ranges, content.length);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  merged.forEach((range, index) => {
    if (range.offset > cursor) parts.push(content.slice(cursor, range.offset));
    parts.push(
      <mark key={`${range.offset}-${index}`} className="rounded-sm bg-warning/30 text-foreground">
        {content.slice(range.offset, range.offset + range.length)}
      </mark>,
    );
    cursor = range.offset + range.length;
  });
  if (cursor < content.length) parts.push(content.slice(cursor));

  return (
    <pre
      // `<pre>` is `generic`, which ARIA forbids naming; `group` takes a name and is not a
      // landmark, so two compared files do not become two entries in the landmark list.
      role="group"
      tabIndex={0}
      aria-label={label}
      className="max-h-[32rem] overflow-auto rounded-lg border border-border bg-card p-3 text-xs leading-relaxed whitespace-pre"
    >
      <code>{parts}</code>
    </pre>
  );
}
