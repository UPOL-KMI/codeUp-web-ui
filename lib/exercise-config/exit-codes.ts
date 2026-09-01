/**
 * A test's accepted exit codes, which core-api stores as a list of tokens
 * (`["0", "2-4"]`) and the form edits as one string (`"0, 2-4"`).
 *
 * The round trip is deliberately lossy in one direction: parsing goes through a bitmap, so
 * `"3, 1-2, 2"` normalises to `"1-3"` on save. That is the legacy behaviour and it is the useful
 * one -- what core-api stores is a set, and two spellings of the same set should not read as a
 * change to the exercise.
 */
const SYNTAX = /^\s*[0-9]{0,3}(-[0-9]{0,3})?(\s*,\s*[0-9]{0,3}(-[0-9]{0,3})?)*\s*$/;

export function isValidExitCodes(value: string): boolean {
  if (!SYNTAX.test(value)) return false;
  return value.split(/[-,]/).every((part) => {
    const code = Number.parseInt(part, 10);
    return !Number.isNaN(code) && code >= 0 && code <= 255;
  });
}

function markRange(bitmap: boolean[], from: number, to: number): void {
  if (to < from) [from, to] = [to, from];
  while (bitmap.length < from) bitmap.push(false);
  for (let code = from; code <= to; code++) bitmap[code] = true;
}

export function exitCodesToBitmap(value: string): boolean[] {
  const bitmap: boolean[] = [];
  if (!isValidExitCodes(value)) return bitmap;
  for (const token of value.split(",")) {
    const [from = "", to] = token.trim().split("-");
    markRange(bitmap, Number.parseInt(from, 10), Number.parseInt(to ?? from, 10));
  }
  return bitmap;
}

export function bitmapToExitCodes(bitmap: boolean[]): string[] {
  const tokens: string[] = [];
  let index = 0;
  while (index < bitmap.length) {
    while (index < bitmap.length && !bitmap[index]) index++;
    if (index >= bitmap.length) break;
    const from = index;
    while (index < bitmap.length && bitmap[index]) index++;
    const to = index - 1;
    tokens.push(from === to ? String(from) : `${from}-${to}`);
  }
  return tokens;
}

/** `"3, 1-2"` -> `["1-3"]`, the shape core-api stores. An unparseable string yields no codes. */
export function parseExitCodes(value: string): string[] {
  return bitmapToExitCodes(exitCodesToBitmap(value));
}

/** `["0", "2-4"]` -> `"0, 2-4"`. An empty list reads as `"0"`, core-api's own default. */
export function formatExitCodes(tokens: string[] | undefined): string {
  return (tokens && tokens.length > 0 ? tokens : ["0"]).join(", ");
}
