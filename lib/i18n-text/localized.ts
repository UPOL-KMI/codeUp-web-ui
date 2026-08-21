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
