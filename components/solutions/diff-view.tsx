import { getTranslations } from "next-intl/server";

import { diffLines, type DiffRow } from "@/lib/code/diff";
import { highlightToLines, type CodeToken, type HighlightedCode } from "@/lib/code/highlight";
import { paletteCss, tokenClassName } from "@/lib/code/palette";
import { languageForFilename } from "@/lib/code/languages";

/**
 * Two versions of one file, side by side (G-005).
 *
 * **A table, and a real one.** Each row is one aligned pair of lines, so the rows are genuinely
 * tabular and a screen reader reading "row 12, left column, right column" is reading what is on
 * screen. P-002 found the cost of pretending otherwise -- a `display: block` on a table strips
 * exactly those semantics -- so this one keeps `scope`, a caption and one header row.
 *
 * **Colour is never the only signal.** A changed line carries a `+` or `-` in its own column and
 * that mark is what a screen reader announces; the tint is for the sighted reader scanning the
 * page. P-002's lesson from the points matrix, applied before somebody has to file it.
 *
 * Highlighted through the same Shiki pipeline as every other code surface in this app: the two
 * files are tokenised once each, and each aligned row takes its tokens from whichever side it came
 * from. So a diff and the source viewer cannot colour the same file two different ways.
 */
/**
 * A row's tokens **and the palette they index into** (PF-003). The two sides are highlighted
 * separately, so each has its own palette and a token's index means nothing without the one it
 * was built against -- returning them together is what keeps the pairing impossible to get wrong.
 */
function rowTokens(
  row: DiffRow,
  left: HighlightedCode,
  right: HighlightedCode,
): { tokens: CodeToken[]; palette: Record<string, string>[] } {
  if (row.leftNumber !== null) {
    return {
      tokens: left.lines[row.leftNumber - 1] ?? [[row.text]],
      palette: left.palette,
    };
  }
  if (row.rightNumber !== null) {
    return {
      tokens: right.lines[row.rightNumber - 1] ?? [[row.text]],
      palette: right.palette,
    };
  }
  return { tokens: [[row.text]], palette: [] };
}

/** Both sides' palettes as one stylesheet -- `paletteCss` de-duplicates by rule text. */
function paletteRules(left: HighlightedCode, right: HighlightedCode): string {
  return paletteCss([...left.palette, ...right.palette]);
}

/**
 * One row's tokens as coloured spans (PF-003, PF-009). A component rather than an inline callback
 * because a row's tokens and the palette they index into have to travel together -- see
 * `rowTokens` -- and spreading one object into props is what makes that pairing hard to get wrong.
 */
function RowTokens({
  tokens,
  palette,
}: {
  tokens: CodeToken[];
  palette: Record<string, string>[];
}) {
  return tokens.map(([content, style], index) => {
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
  });
}

const ROW_TONE: Record<DiffRow["kind"], string> = {
  equal: "",
  added: "bg-success/10",
  removed: "bg-destructive/10",
};

export async function DiffView({
  name,
  leftContent,
  rightContent,
  leftLabel,
  rightLabel,
}: {
  name: string;
  leftContent: string;
  rightContent: string;
  leftLabel: string;
  rightLabel: string;
}) {
  const t = await getTranslations("Diff");
  const language = languageForFilename(name);
  const [left, right] = await Promise.all([
    highlightToLines(leftContent, language),
    highlightToLines(rightContent, language),
  ]);
  const diff = diffLines(leftContent, rightContent);
  const rules = paletteRules(left, right);

  if (diff.identical) {
    return (
      <section className="flex flex-col gap-2" aria-labelledby={`diff-${name}`}>
        <h3 id={`diff-${name}`} className="font-mono text-sm font-medium">
          {name}
        </h3>
        <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
          {t("identical")}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2" aria-labelledby={`diff-${name}`}>
      <h3 id={`diff-${name}`} className="font-mono text-sm font-medium">
        {name}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t("counts", { added: diff.added, removed: diff.removed })}
      </p>
      {/* PF-009: both sides' palettes, since a row's tokens may come from either and each side
          was highlighted separately. Class names are colour-derived, so the two overlap into one
          rule wherever they share a colour. */}
      {rules !== "" && <style>{rules}</style>}
      <div className="overflow-x-auto rounded-lg border border-border" tabIndex={0}>
        <table className="w-full border-collapse text-sm" style={left.rootStyle}>
          <caption className="sr-only">
            {t("caption", { name, left: leftLabel, right: rightLabel })}
          </caption>
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="px-2 py-1 text-right font-medium">
                {t("columns.leftLine")}
              </th>
              <th scope="col" className="px-2 py-1 text-right font-medium">
                {t("columns.rightLine")}
              </th>
              <th scope="col" className="px-2 py-1 text-left font-medium">
                {t("columns.change")}
              </th>
              <th scope="col" className="px-2 py-1 text-left font-medium">
                {t("columns.line")}
              </th>
            </tr>
          </thead>
          <tbody className="shiki font-mono">
            {diff.rows.map((row, index) => (
              <tr key={index} className={ROW_TONE[row.kind]}>
                <td className="w-12 px-2 py-0.5 text-right align-top tabular-nums text-muted-foreground select-none">
                  {row.leftNumber ?? ""}
                </td>
                <td className="w-12 px-2 py-0.5 text-right align-top tabular-nums text-muted-foreground select-none">
                  {row.rightNumber ?? ""}
                </td>
                <td className="w-8 px-2 py-0.5 align-top select-none">
                  <span className="sr-only">{t(`kind.${row.kind}`)}</span>
                  <span aria-hidden="true">
                    {row.kind === "added" ? "+" : row.kind === "removed" ? "−" : ""}
                  </span>
                </td>
                <td className="px-2 py-0.5 align-top whitespace-pre-wrap">
                  <RowTokens {...rowTokens(row, left, right)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
