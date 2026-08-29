"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

/**
 * Finding a person by name, to add them to something (S-009).
 *
 * Searches through this app's own `/api/search` route with `kinds=user`, the same BFF endpoint the
 * command palette uses (D-015) -- core-api has no user search this app may call from the browser,
 * and the token stays on the server either way (brief §5). Two characters minimum and a debounce,
 * for the same reason that route already applies its own floor: below that, every query matches
 * nearly everyone.
 *
 * core-api answers 403 to a reader who may not search users at all, which the route turns into an
 * empty result -- so a picker rendered for someone without the permission simply finds nobody,
 * rather than breaking the page around it.
 */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

interface UserHit {
  id: string;
  label: string;
}

export function UserPicker({
  label,
  actionLabel,
  onPick,
  excludeIds,
  pending,
}: {
  label: string;
  actionLabel: string;
  onPick: (userId: string) => void;
  excludeIds: string[];
  pending: boolean;
}) {
  const t = useTranslations("Group.settings.members");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<UserHit[]>([]);
  const [searching, setSearching] = useState(false);

  const term = query.trim();

  useEffect(() => {
    if (term.length < MIN_QUERY) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/search?kinds=user&locale=${locale}&q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
        .then((response) => response.json() as Promise<{ hits?: UserHit[] }>)
        .then((body) => setHits(body.hits ?? []))
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, locale]);

  // Derived, not cleared in the effect: a query below the floor simply has no results to show,
  // and clearing state synchronously inside an effect is a cascading render (and this repo's lint
  // rejects it on sight).
  const results = term.length < MIN_QUERY ? [] : hits.filter((hit) => !excludeIds.includes(hit.id));

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        {label}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      {term.length >= MIN_QUERY && (
        <ul className="flex flex-col gap-1">
          {results.length === 0 && (
            <li className="text-sm text-muted-foreground">
              {searching ? t("searching") : t("noMatches")}
            </li>
          )}
          {results.map((hit) => (
            <li key={hit.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{hit.label}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => onPick(hit.id)}
                className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
              >
                {actionLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
