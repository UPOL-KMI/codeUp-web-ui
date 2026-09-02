/**
 * `%%key%%` placeholders in an authored text, replaced with the file they name (T-023).
 *
 * An exercise author writes `![diagram](%%fig1%%)` and defines `fig1` as a link to one of the
 * exercise's own files. core-api resolves the link at download time -- checking the role the link
 * requires -- so the URL substituted here is a **public core-api address**, not this app's, and it
 * carries no token: the link's own `requiredRole` is what decides who may fetch it (`null` means
 * anybody, including somebody who is not signed in). That is core-api's design, not a shortcut
 * taken here, and it is what makes an exercise text usable in a printed handout.
 *
 * The substitution is a plain string replace, done before the markdown is parsed -- the same order
 * the legacy app does it in, and the only order that works: a placeholder can stand anywhere a URL
 * can, including inside a link target, where no post-parse transform could reach it.
 *
 * A placeholder with no matching link is **left as it is**, visible in the rendered text. That is
 * deliberate: silently deleting it would hide a broken reference from the only person who can fix
 * it, and an author who sees `%%fig1%%` in their own exercise knows exactly what is wrong.
 */
export interface FileLinkMap {
  [key: string]: string;
}

/** The public core-api address a file link resolves at. */
export function fileLinkUrl(apiBase: string, linkId: string): string {
  return `${apiBase.replace(/\/+$/, "")}/uploaded-files/link/${linkId}`;
}

export function replaceLinkKeys(text: string, links: FileLinkMap): string {
  if (!text) return text;
  let result = text;
  for (const [key, url] of Object.entries(links)) {
    result = result.replaceAll(`%%${key}%%`, url);
  }
  return result;
}
