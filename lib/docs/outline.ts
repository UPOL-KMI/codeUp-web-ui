import GithubSlugger from "github-slugger";

export interface OutlineEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

/**
 * The `##` and `###` headings of a guide, with the ids `rehype-slug` gives them: the same slugger
 * over the same text, so an outline link lands on its heading. Fences are skipped -- a `#` inside
 * one is a shell comment, not a chapter.
 */
export function guideOutline(source: string): OutlineEntry[] {
  const slugger = new GithubSlugger();
  const entries: OutlineEntry[] = [];
  let inFence = false;
  for (const line of source.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const text = plainText(match[2]!);
    entries.push({ id: slugger.slug(text), text, depth: match[1]!.length as 2 | 3 });
  }
  return entries;
}

function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[*_~]+([^*_~]+)[*_~]+/g, "$1")
    .trim();
}
