/**
 * The token palette as CSS rather than as an inline `style` on every `<span>` (PF-009).
 *
 * **Its own module, not part of `highlight.ts`, and the build is what insisted.** `highlight.ts`
 * is `server-only`; `CodeLine` needs these two functions and is rendered inside a *client* island
 * by S-018's review viewer, so importing them from there pulled `server-only` into a client
 * bundle -- `pnpm build` failed with "'server-only' cannot be imported from a Client Component
 * module", which `typecheck`, `lint` and the unit tests had all passed over. They are pure
 * functions of their argument with no server dependency, so this is where they belonged anyway.
 *
 * **Measured, not assumed:** on the 26 kB file PF-003 measured, the inline custom properties are
 * 155,907 bytes of the served HTML against 36,684 for class attributes plus 384 for the rules --
 * the largest single thing left in a code page after the props payload.
 *
 * **The class name is derived from the colours, not from the palette index**, and that is what
 * makes this safe without plumbing a unique prefix through three components. Several files render
 * on one page, each with its own palette, so index-based names would collide *and mean different
 * things*. Colour-based names collide only when two blocks genuinely share a colour, where the
 * duplicate rule is identical and therefore harmless.
 *
 * The cascade this touches was checked rather than hoped for: `app/globals.css` reads the two
 * properties in `.shiki span { color: var(--shiki-light) }` and switches which one under `.dark`,
 * a class setting them is the only source once the inline copy is gone, and the `:target` line
 * highlight sets `background-color` -- so it never competed with the token colour at all.
 */
const HEX = /^#[0-9A-Fa-f]{3,8}$/;

/** The two themes' own block backgrounds (`github-light`, `github-dark`), which is what every
 *  token sits on; a token's colour is pushed towards the opposite pole until it reads at WCAG AA
 *  against them (X-009). github-dark's comment grey, for one, does not on its own. */
const LIGHT_BACKGROUND = "#ffffff";
const DARK_BACKGROUND = "#24292e";
const MINIMUM_CONTRAST = 4.5;

function channels(hex: string): [number, number, number] {
  const body = hex.slice(1);
  const wide = body.length <= 4 ? [...body].map((c) => c + c).join("") : body;
  return [0, 2, 4].map((i) => parseInt(wide.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mixes `hex` towards `pole` in twentieths until it reads against `background`. */
function readable(hex: string, background: string, pole: number): string {
  const bg = channels(background);
  let rgb = channels(hex);
  let steps = 0;
  for (; steps < 20 && contrast(rgb, bg) < MINIMUM_CONTRAST; steps += 1) {
    rgb = rgb.map((v) => Math.round(v + (pole - v) * 0.1)) as [number, number, number];
  }
  // Untouched when it already reads: the rule embeds the theme's value as written.
  if (steps === 0) return hex;
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
}

function readablePair(style: Record<string, string>): [string, string] | null {
  const light = style["--shiki-light"] ?? "";
  const dark = style["--shiki-dark"] ?? "";
  // A value that is not a plain hex colour gets no class and keeps its inline style: this exists
  // so a future theme, or a Shiki that starts emitting `var(...)` or a gradient, degrades to the
  // old behaviour instead of writing something unintended into a stylesheet.
  if (!HEX.test(light) || !HEX.test(dark)) return null;
  return [readable(light, LIGHT_BACKGROUND, 0), readable(dark, DARK_BACKGROUND, 255)];
}

export function tokenClassName(style: Record<string, string>): string {
  const pair = readablePair(style);
  if (!pair) return "";
  return `tk${pair[0].slice(1)}${pair[1].slice(1)}`.toLowerCase();
}

/**
 * The `<style>` body for one file's palette. Empty when every style had to stay inline.
 *
 * **Keyed by class name rather than by rule text**, which is not the same thing and was worth a
 * test: the name is lower-cased and the rule embeds the value as written, so `#032F62` and
 * `#032f62` are one class and two different strings. Deduplicating the strings emitted the same
 * selector twice with equivalent values -- harmless on the page, wrong in the bytes, and it would
 * have quietly contradicted this module's claim that a shared colour collapses to one rule.
 */
export function paletteCss(palette: Record<string, string>[]): string {
  const rules = new Map<string, string>();
  for (const style of palette) {
    const pair = readablePair(style);
    const name = tokenClassName(style);
    if (!pair || name === "" || rules.has(name)) continue;
    rules.set(name, `.${name}{--shiki-light:${pair[0]};--shiki-dark:${pair[1]}}`);
  }
  return [...rules.values()].join("");
}
