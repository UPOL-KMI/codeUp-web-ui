import type { CodeToken } from "@/lib/code/highlight";

/**
 * The presentational half of the code viewer (D-009): the `<pre>` surface and one line of it.
 *
 * Neither is marked `"use client"` and neither imports anything server-only, deliberately -- the
 * plain viewer (`CodeViewer`) renders them on the server, and the reviewable viewer (S-018)
 * renders the same two components inside a client island so it can interleave comment threads
 * between lines. One definition, so the two viewers cannot drift into looking different.
 *
 * The line number is a real `<a>` rather than a CSS counter, because a counter cannot be linked
 * to, focused, or opened in a new tab; `:target` styling in `app/globals.css` then highlights the
 * linked line with no JavaScript at all.
 */
export interface CodeLineProps {
  tokens: CodeToken[];
  /**
   * The block's distinct token styles (PF-003). A token names one by index rather than carrying
   * the object, so the array that crosses into a client island is integers instead of 1,916 copies
   * of eight objects.
   */
  palette: Record<string, string>[];
  /** 1-based line number, as shown in the gutter and used in the anchor. */
  number: number;
  /** Prefixes the anchor id, so several files on one page do not all claim `#L1`. */
  idPrefix?: string;
  /** Accessible name for the line-number link (`Code.lineLabel`). */
  label: string;
}

export function CodeLine({ tokens, palette, number, idPrefix = "", label }: CodeLineProps) {
  const id = `${idPrefix}L${number}`;
  return (
    <span className="line" id={id} data-line={number}>
      <a href={`#${id}`} className="code-line-number" aria-label={label}>
        {number}
      </a>
      {tokens.map(([content, style], index) => (
        <span key={index} style={style === undefined ? undefined : palette[style]}>
          {content}
        </span>
      ))}
    </span>
  );
}

export function CodeBlock({
  rootStyle,
  children,
}: {
  rootStyle: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <div data-slot="code-block" className="overflow-x-auto text-sm">
      <pre className="shiki" style={rootStyle}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

/**
 * The same surface for code that has things rendered *between* its lines (S-018's comment threads
 * and comment form). Deliberately a `<div>` rather than a `<pre>`: `<pre>`'s content model is
 * phrasing content, and a `<form>` inside one is invalid markup that the browser's parser is free
 * to move -- which shows up as a hydration mismatch, not as a warning. Whitespace is preserved by
 * `.code-annotated` in `app/globals.css` instead of by the element's default style.
 */
export function AnnotatedCodeBlock({
  rootStyle,
  children,
}: {
  rootStyle: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <div data-slot="code-block" className="overflow-x-auto text-sm">
      <div className="shiki code-annotated" style={rootStyle}>
        {children}
      </div>
    </div>
  );
}
