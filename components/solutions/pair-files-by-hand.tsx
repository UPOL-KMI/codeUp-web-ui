import { getTranslations } from "next-intl/server";

import { encodeFilePair, type FilePairingOverride } from "@/lib/code/diff";

import { Link } from "@/i18n/navigation";

/**
 * The files two attempts do not share, and the reader's way of saying which goes with which
 * (G-005's list, G-030's control).
 *
 * **A plain `GET` form, one per file, and no JavaScript.** It carries no `action`, so it submits
 * to the address already on screen -- which is also how it stays right under a locale prefix or a
 * deployment path prefix, neither of which a hand-written action would know about. The pairing has
 * to reach the server --
 * it decides which files are fetched, read and tokenised -- so it belongs in the address, and a
 * form whose select carries whole `left:right` values needs nothing beyond the browser to put it
 * there. That is T-020's trade for the exercise catalog restated: the narrowed view is a URL, and
 * a URL is something a teacher can send.
 *
 * The pairings already made ride along as hidden fields, so choosing a second pair keeps the
 * first. Order is preserved because `pairFilesByName` honours the first claim on a file, and the
 * hidden fields come before the select.
 *
 * A pairing is undone by dropping it, not by re-choosing: each one is listed with its own "undo"
 * link carrying every *other* pairing, which is the whole mechanism the legacy dialog's
 * "unmap" button has and needs no dialog at all.
 */
export async function PairFilesByHand({
  basePath,
  onlyLeft,
  onlyRight,
  overrides,
  leftLabel,
  rightLabel,
}: {
  basePath: string;
  onlyLeft: string[];
  onlyRight: string[];
  overrides: FilePairingOverride[];
  leftLabel: string;
  rightLabel: string;
}) {
  const t = await getTranslations("Diff.unpaired");

  const href = (pairs: FilePairingOverride[]) => {
    if (pairs.length === 0) return basePath;
    const params = new URLSearchParams();
    for (const pair of pairs) params.append("pair", encodeFilePair(pair.left, pair.right));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <section aria-labelledby="diff-unpaired" className="flex flex-col gap-3">
      <h2 id="diff-unpaired" className="text-base font-semibold tracking-tight">
        {t("title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("explain")}</p>

      {overrides.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {overrides.map((pair) => (
            <li
              key={`${pair.left}\u0000${pair.right}`}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="font-mono">
                {t("pairedByHand", { left: pair.left, right: pair.right })}
              </span>
              <Link
                href={href(overrides.filter((other) => other !== pair))}
                className="text-muted-foreground underline hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t("undo")}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {onlyLeft.length > 0 && onlyRight.length > 0 && (
        <p className="text-sm text-muted-foreground">{t("pairHint")}</p>
      )}

      <ul className="flex flex-col gap-2 text-sm">
        {onlyLeft.map((name) => (
          <li key={`l-${name}`} className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{t("onlyIn", { name, side: leftLabel })}</span>
            {onlyRight.length > 0 && (
              <form method="get" className="flex flex-wrap items-center gap-2">
                {overrides.map((pair) => (
                  <input
                    key={`${pair.left}\u0000${pair.right}`}
                    type="hidden"
                    name="pair"
                    value={encodeFilePair(pair.left, pair.right)}
                  />
                ))}
                {/* Not a `<label>`: the select's own `aria-label` names it after the file it is
                    about ("Compare helper.py with"), which is what tells three of these apart, and
                    a wrapping label would override that with the two words beside it. The visible
                    words are a fragment of the accessible name, which is the rule that matters. */}
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">{t("compareWith")}</span>
                  <select
                    name="pair"
                    defaultValue=""
                    required
                    aria-label={t("compareWithFile", { name })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="" disabled>
                      {t("choose")}
                    </option>
                    {onlyRight.map((other) => (
                      <option key={other} value={encodeFilePair(name, other)}>
                        {other}
                      </option>
                    ))}
                  </select>
                </span>
                <button
                  type="submit"
                  className="rounded-md border border-input px-2 py-1 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {t("pair")}
                </button>
              </form>
            )}
          </li>
        ))}
        {onlyRight.map((name) => (
          <li key={`r-${name}`} className="font-mono">
            {t("onlyIn", { name, side: rightLabel })}
          </li>
        ))}
      </ul>
    </section>
  );
}
