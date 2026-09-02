"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
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
 * / `role="option"` wiring, arrow-key and Home/End handling -- are the kind of thing that looks
 * finished long before it is correct for a screen-reader user.
 * `cmdk` itself renders through Radix's Dialog, so this stays in the same primitive family.
 * What it does not ship is a live region (nor translated names for its own listbox and busy
 * indicator, hence the `label` props below), so the result count is announced here instead.
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

/** `open` is owned by `SidebarNav`, not here: the trigger has to appear in both halves of the
 *  shell's chrome, and that is the only component rendering both. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: Dispatch<SetStateAction<boolean>>;
}) {
  const t = useTranslations("Palette");
  const locale = useLocale();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [hitsQuery, setHitsQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Cmd+K on macOS, Ctrl+K elsewhere -- both, unconditionally, rather than sniffing the platform:
  // the wrong guess makes the feature simply not exist for that user, and there is no cost to
  // accepting both.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange((current) => !current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

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
        .then((body) => {
          setHits(body.hits ?? []);
          setHitsQuery(trimmed);
        })
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
    onOpenChange(false);
    setQuery("");
    router.push(hit.href);
  };

  // Announced only once the fetch for *this* query has landed: through the debounce window `hits`
  // still holds the previous query's answer, and announcing that is worse than saying nothing.
  const status = loading
    ? t("loading")
    : isSearchable && hitsQuery === trimmed
      ? t("resultCount", { count: visibleHits.length })
      : "";

  const groups: { kind: SearchHit["kind"]; heading: string }[] = [
    { kind: "group", heading: t("groups") },
    { kind: "exercise", heading: t("exercises") },
    { kind: "user", heading: t("users") },
  ];

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
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
      <Command.List label={t("results")} className="max-h-80 overflow-y-auto p-2">
        {loading && (
          <Command.Loading label={t("loading")} className="px-2 py-3 text-sm text-muted-foreground">
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
                  className="cursor-pointer truncate rounded-md px-2 py-1.5 text-sm font-normal normal-case text-foreground data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                >
                  {hit.label}
                </Command.Item>
              ))}
            </Command.Group>
          );
        })}
      </Command.List>
      {/* A listbox may only contain options, so this sits outside Command.List rather than in it. */}
      <span role="status" className="sr-only">
        {status}
      </span>
    </Command.Dialog>
  );
}

export function CommandPaletteTrigger({
  onOpen,
  className,
}: {
  onOpen: () => void;
  className: string;
}) {
  const t = useTranslations("Palette");

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`rounded-md border border-input text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      {t("open")}
    </button>
  );
}
