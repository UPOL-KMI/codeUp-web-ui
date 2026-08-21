"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

/**
 * Global command palette (D-015, `docs/IA.md` §3.4): Cmd/Ctrl-K to jump to a group, exercise or
 * user by name.
 *
 * Built on `cmdk` rather than on this repo's own `Dialog` plus a list. The reasoning is the one
 * DEC-054 used for Radix: a command palette is a **combobox**, and combobox semantics --
 * `aria-activedescendant` moving through options while focus stays in the input, `role="listbox"`
 * / `role="option"` wiring, arrow-key and Home/End handling, announcing the count of results --
 * are the kind of thing that looks finished long before it is correct for a screen-reader user.
 * `cmdk` itself renders through Radix's Dialog, so this stays in the same primitive family.
 *
 * Search is server-side (`/api/search`), never core-api directly: the session token stays in the
 * httpOnly cookie (brief §5), and that route also flattens the three different response shapes
 * core-api returns for these lists.
 */
interface SearchHit {
  id: string;
  label: string;
  href: string;
  kind: "group" | "exercise" | "user";
}

const DEBOUNCE_MS = 200;
/** Below this, every list endpoint matches nearly everything -- slow for core-api, useless here. */
const MIN_QUERY_LENGTH = 2;

export function CommandPalette() {
  const t = useTranslations("Palette");
  const locale = useLocale();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  // Cmd+K on macOS, Ctrl+K elsewhere -- both, unconditionally, rather than sniffing the platform:
  // the wrong guess makes the feature simply not exist for that user, and there is no cost to
  // accepting both.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Short queries are handled by *deriving* the empty result below rather than by clearing state
  // here: a synchronous `setState` in an effect body is both an extra render and something this
  // repo's lint config rejects outright -- for the fourth time in this phase, and it has been
  // right every time. The effect now only ever starts work; it never corrects state.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;

    // Debounced, and every in-flight request is aborted when the query moves on -- without the
    // abort, a slow response for "ab" can land after the response for "abcd" and repopulate the
    // list with stale results.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}&locale=${locale}`, {
        signal: controller.signal,
      })
        .then((response) => response.json() as Promise<{ hits?: SearchHit[] }>)
        .then((body) => setHits(body.hits ?? []))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, locale]);

  const trimmed = query.trim();
  const isSearchable = trimmed.length >= MIN_QUERY_LENGTH;
  // Derived, not stored: below the minimum length there are no results by definition, and the
  // previous query's hits must not linger just because the user backspaced.
  const visibleHits = isSearchable ? hits : [];

  const select = (hit: SearchHit) => {
    setOpen(false);
    setQuery("");
    router.push(hit.href);
  };

  const groups: { kind: SearchHit["kind"]; heading: string }[] = [
    { kind: "group", heading: t("groups") },
    { kind: "exercise", heading: t("exercises") },
    { kind: "user", heading: t("users") },
  ];

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t("label")}
      // cmdk filters its own items by default, which would fight the server-side search: the API
      // already decided what matches (including on fields the label does not show, e.g. a user's
      // email), and re-filtering client-side would silently drop those hits.
      shouldFilter={false}
      className="fixed top-24 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-background shadow-lg"
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder={t("placeholder")}
        className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none"
      />
      <Command.List className="max-h-80 overflow-y-auto p-2">
        {loading && (
          <Command.Loading className="px-2 py-3 text-sm text-muted-foreground">
            {t("loading")}
          </Command.Loading>
        )}
        {!loading && isSearchable && visibleHits.length === 0 && (
          <Command.Empty className="px-2 py-3 text-sm text-muted-foreground">
            {t("empty")}
          </Command.Empty>
        )}
        {!isSearchable && <p className="px-2 py-3 text-sm text-muted-foreground">{t("hint")}</p>}

        {groups.map(({ kind, heading }) => {
          const items = visibleHits.filter((hit) => hit.kind === kind);
          if (items.length === 0) return null;
          return (
            <Command.Group
              key={kind}
              heading={heading}
              className="px-1 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {items.map((hit) => (
                <Command.Item
                  key={`${hit.kind}-${hit.id}`}
                  value={`${hit.kind}-${hit.id}`}
                  onSelect={() => select(hit)}
                  className="cursor-pointer truncate rounded-md px-2 py-1.5 text-sm font-normal normal-case text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  {hit.label}
                </Command.Item>
              ))}
            </Command.Group>
          );
        })}
      </Command.List>
    </Command.Dialog>
  );
}
