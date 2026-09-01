/**
 * core-api returns human-readable names and descriptions as a `localizedTexts` array, one entry
 * per locale, with no top-level `name` field -- confirmed against a live `/v1/groups` response
 * rather than assumed from the entity classes. Every screen that shows a group, assignment or
 * exercise name needs this, so it lives here rather than being re-derived per component.
 *
 * Falls back to the first available entry rather than rendering nothing: a group whose supervisor
 * only filled in Czech must still be visible to a user reading the English UI. Returning an empty
 * string would produce an invisible, unclickable row -- worse than the wrong language.
 */
export interface LocalizedText {
  locale: string;
  name?: string;
  description?: string;
}

export function localizedName(texts: LocalizedText[] | undefined, locale: string): string {
  if (!texts?.length) return "";
  const match = texts.find((text) => text.locale === locale) ?? texts[0]!;
  return match.name ?? "";
}

/**
 * The description half of the same array. Kept separate from `localizedName` because the two fall
 * back differently: a group named only in Czech still has a name to show an English reader, but a
 * group whose Czech text carries a description and whose English one does not should show the
 * Czech description rather than nothing -- so the fallback here is "the first entry that actually
 * has one", not "the first entry".
 */
export function localizedDescription(texts: LocalizedText[] | undefined, locale: string): string {
  if (!texts?.length) return "";
  const match = texts.find((text) => text.locale === locale && text.description);
  return (match ?? texts.find((text) => text.description))?.description ?? "";
}
