/**
 * A line diff, for comparing two solutions (G-005).
 *
 * **Written here rather than pulled in.** The legacy app ships `react-diff-viewer`, which is a
 * React component with its own markup, its own styling and its own highlighter -- none of which
 * this app can use, because code is tokenised on the *server* here (Shiki, `lib/code/highlight.ts`)
 * and rendered through one shared `CodeLine`. What is actually needed is the pairing decision, and
 * that is this file: forty lines of Myers-style bookkeeping, unit-tested, shipping nothing to the
 * browser.
 *
 * Longest common subsequence, computed with the classic dynamic-programming table. The table is
 * `O(n·m)` in both time and memory, which is why the caller bounds what it hands over -- the same
 * ceiling `canDisplayFiles()` already applies to the viewer (32 files, 1 MiB), so the worst case
 * here is a pair of files inside that budget rather than an arbitrary one.
 *
 * Compared **by exact line text**. Trimming whitespace before comparing would hide the one class of
 * change a grader most often wants to see in a submission -- indentation -- and normalising it away
 * to make a diff look tidier would be this app deciding the two files are more alike than they are.
 */
export type DiffRowKind = "equal" | "added" | "removed";

export interface DiffRow {
  kind: DiffRowKind;
  /** 1-based line number in the left file, or null where the row exists only on the right. */
  leftNumber: number | null;
  /** 1-based line number in the right file, or null where the row exists only on the left. */
  rightNumber: number | null;
  text: string;
}

export interface DiffSummary {
  rows: DiffRow[];
  added: number;
  removed: number;
  /** True when the two files are identical line for line -- worth saying rather than showing. */
  identical: boolean;
}

function splitLines(source: string): string[] {
  // An empty file is no lines, not one blank one -- `"".split("\n")` says otherwise, and a diff
  // that reports "removed a blank line" for a file that was never there is a lie.
  if (source === "") return [];
  // A trailing newline ends the last line rather than starting an empty one, which is what every
  // editor shows and what makes "added a line at the end" read as one row instead of two.
  const lines = source.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function diffLines(left: string, right: string): DiffSummary {
  const a = splitLines(left);
  const b = splitLines(right);

  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] =
        a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const rows: DiffRow[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ kind: "equal", leftNumber: i + 1, rightNumber: j + 1, text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      rows.push({ kind: "removed", leftNumber: i + 1, rightNumber: null, text: a[i]! });
      removed++;
      i++;
    } else {
      rows.push({ kind: "added", leftNumber: null, rightNumber: j + 1, text: b[j]! });
      added++;
      j++;
    }
  }
  for (; i < a.length; i++) {
    rows.push({ kind: "removed", leftNumber: i + 1, rightNumber: null, text: a[i]! });
    removed++;
  }
  for (; j < b.length; j++) {
    rows.push({ kind: "added", leftNumber: null, rightNumber: j + 1, text: b[j]! });
    added++;
  }

  return { rows, added, removed, identical: added === 0 && removed === 0 };
}

/**
 * Which files of two solutions are compared against which (G-005).
 *
 * **Paired by name, and everything unpaired is named rather than dropped.** Two attempts at the
 * same exercise almost always carry the same filenames, so matching on the name is right nearly
 * always -- and when it is not, silently comparing `main.py` against `solution.py` because they
 * happen to be the only files left would be worse than saying they did not match. The legacy app
 * lets a reader map those by hand; that is G-030, and until it exists this screen tells the reader
 * exactly which files it could not pair instead of pretending.
 *
 * A ZIP entry's `name` already carries its archive (`archive.zip#src/main.c`), so entries pair on
 * the same rule with no special case.
 */
export interface FilePairing<T extends { name: string }> {
  pairs: { left: T; right: T }[];
  onlyLeft: T[];
  onlyRight: T[];
}

export function pairFilesByName<T extends { name: string }>(
  left: readonly T[],
  right: readonly T[],
): FilePairing<T> {
  const rightByName = new Map(right.map((file) => [file.name, file]));
  const pairs: { left: T; right: T }[] = [];
  const onlyLeft: T[] = [];

  for (const file of left) {
    const match = rightByName.get(file.name);
    if (match === undefined) {
      onlyLeft.push(file);
    } else {
      pairs.push({ left: file, right: match });
      rightByName.delete(file.name);
    }
  }

  return { pairs, onlyLeft, onlyRight: [...rightByName.values()] };
}
