import type { CodeToken } from "@/lib/code/highlight";
import { paletteCss, tokenClassName } from "@/lib/code/palette";

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
  /** The file's distinct token styles; `CodeToken.style` indexes into it (PF-003). */
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
      {/* Destructured rather than read by name: a token is a `[content, style]` tuple (PF-009).
          The colour arrives by class where `paletteCss` could emit a rule for it, and by inline
          style otherwise -- see `tokenClassName` for what "otherwise" means. */}
      {tokens.map(([content, style], index) => {
        const entry = style === undefined ? undefined : palette[style];
        const className = entry ? tokenClassName(entry) : "";
        return (
          <span
            key={index}
            className={className || undefined}
            style={entry && className === "" ? entry : undefined}
          >
            {content}
          </span>
        );
      })}
    </span>
  );
}

export function CodeBlock({
  rootStyle,
  palette,
  children,
}: {
  rootStyle: Record<string, string>;
  /** This file's token styles, emitted as rules rather than repeated inline (PF-009). */
  palette: Record<string, string>[];
  children: React.ReactNode;
}) {
  return (
    <div data-slot="code-block" className="overflow-x-auto text-sm">
      <PaletteRules palette={palette} />
      <pre className="shiki" style={rootStyle}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

/**
 * One file's palette as CSS. Rendered beside the block rather than collected into `globals.css`
 * because the palette is a property of the *file* -- what colours its tokens happen to use -- and
 * a static global would have to enumerate every colour both themes can produce. Class names are
 * derived from the colours (`tokenClassName`), so two blocks on a page that share a colour emit
 * the same rule twice, which is idempotent.
 *
 * The rules are built from hex values this module has already validated, and contain none of the
 * characters React escapes in a text child.
 */
function PaletteRules({ palette }: { palette: Record<string, string>[] }) {
  const css = paletteCss(palette);
  return css === "" ? null : <style>{css}</style>;
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
  palette,
  children,
}: {
  rootStyle: Record<string, string>;
  palette: Record<string, string>[];
  children: React.ReactNode;
}) {
  return (
    <div data-slot="code-block" className="overflow-x-auto text-sm">
      <PaletteRules palette={palette} />
      <div className="shiki code-annotated" style={rootStyle}>
        {children}
      </div>
    </div>
  );
}
