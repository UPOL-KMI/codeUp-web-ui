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

export function tokenClassName(style: Record<string, string>): string {
  const light = style["--shiki-light"] ?? "";
  const dark = style["--shiki-dark"] ?? "";
  // A value that is not a plain hex colour gets no class and keeps its inline style: this exists
  // so a future theme, or a Shiki that starts emitting `var(...)` or a gradient, degrades to the
  // old behaviour instead of writing something unintended into a stylesheet.
  if (!HEX.test(light) || !HEX.test(dark)) return "";
  return `tk${light.slice(1)}${dark.slice(1)}`.toLowerCase();
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
    const name = tokenClassName(style);
    if (name === "" || rules.has(name)) continue;
    rules.set(
      name,
      `.${name}{--shiki-light:${style["--shiki-light"]};--shiki-dark:${style["--shiki-dark"]}}`,
    );
  }
  return [...rules.values()].join("");
}
