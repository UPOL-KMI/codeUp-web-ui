import { describe, expect, it } from "vitest";

import { paletteCss, tokenClassName } from "./palette";

/**
 * PF-009(a). These pin the two things that would go wrong quietly: a class name that is not a
 * valid CSS identifier (so the rule never matches and the token loses its colour with nothing on
 * screen to say so), and a palette value that is not a plain hex colour reaching the stylesheet.
 */
const pair = (light: string, dark: string) => ({ "--shiki-light": light, "--shiki-dark": dark });

describe("tokenClassName", () => {
  it("derives the name from the colours, so two files sharing one agree on it", () => {
    expect(tokenClassName(pair("#032F62", "#9ECBFF"))).toBe("tk032f629ecbff");
    // Same colours written differently must still collapse to one class.
    expect(tokenClassName(pair("#032f62", "#9ecbff"))).toBe("tk032f629ecbff");
  });

  it("starts with a letter, because a CSS identifier may not start with a digit", () => {
    expect(tokenClassName(pair("#032F62", "#9ECBFF"))).toMatch(/^[a-z]/);
  });

  it("declines anything that is not a plain hex pair, leaving it inline", () => {
    // The caller falls back to the inline style on "", so these degrade rather than break.
    expect(tokenClassName(pair("var(--x)", "#9ECBFF"))).toBe("");
    expect(tokenClassName(pair("#032F62", "linear-gradient(red,blue)"))).toBe("");
    expect(tokenClassName(pair("", ""))).toBe("");
    expect(tokenClassName({})).toBe("");
    // The case this guard exists for: a value that would otherwise close the rule and inject.
    expect(tokenClassName(pair("#fff}body{display:none", "#000"))).toBe("");
  });
});

describe("paletteCss", () => {
  it("writes one rule per style, setting both custom properties", () => {
    const css = paletteCss([pair("#032F62", "#9ECBFF")]);
    expect(css).toBe(".tk032f629ecbff{--shiki-light:#032F62;--shiki-dark:#9ECBFF}");
  });

  it("emits a shared colour once, however many palettes it came from", () => {
    const css = paletteCss([
      pair("#032F62", "#9ECBFF"),
      pair("#032f62", "#9ecbff"),
      pair("#24292E", "#E1E4E8"),
    ]);
    expect(css.match(/\.tk/g)).toHaveLength(2);
  });

  it("skips what it cannot express and says so by omission", () => {
    expect(paletteCss([pair("var(--x)", "#000")])).toBe("");
    expect(paletteCss([])).toBe("");
  });

  it("never emits a brace or semicolon that did not come from its own template", () => {
    // A rule built from a rejected value would break out of the block it is in.
    const css = paletteCss([pair("#fff}x{y:z", "#000"), pair("#24292E", "#E1E4E8")]);
    expect(css).toBe(".tk24292ee1e4e8{--shiki-light:#24292E;--shiki-dark:#E1E4E8}");
  });
});
