import { NextResponse } from "next/server";

import { readSessionToken } from "@/lib/auth/session-cookie";
import { localizedName } from "@/lib/i18n-text/localized";

/**
 * Search backing the command palette (D-015, `docs/IA.md` §3.4).
 *
 * **There is no `/search` endpoint in core-api.** The IA names one ("`/api/search` (or
 * equivalent)"), and brief §3.2 forbids inventing endpoints, so this queries the three list
 * endpoints that genuinely accept a `search` parameter -- verified live, not from the spec --
 * and merges the results here rather than making the browser fan out three requests and learn
 * three response shapes.
 *
 * Those shapes are not the same, which is the main reason this route exists: `/users` and
 * `/exercises` return a paginated envelope (`{items, totalCount, offset, limit, ...}`) while
 * `/groups` returns a plain array. Normalising once, server-side, keeps that inconsistency out of
 * the UI entirely.
 *
 * User search is attempted for everyone and allowed to fail: the IA restricts it to
 * teachers/admins, and core-api enforces that itself with a 403. Catching it here means a student
 * gets a working palette without a user section, rather than an error -- and, unlike a role check
 * in this app, it cannot drift from what core-api actually permits.
 */
interface SearchHit {
  id: string;
  label: string;
  href: string;
  kind: "group" | "exercise" | "user";
}

const LIMIT = 8;

async function fetchJson(url: string, token: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const envelope = (await response.json().catch(() => null)) as { payload?: unknown } | null;
  return envelope?.payload ?? null;
}

/** Accepts either shape: a paginated envelope or a bare array. */
function itemsOf(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { items?: unknown }).items)
  ) {
    return (payload as { items: Record<string, unknown>[] }).items;
  }
  return [];
}

export async function GET(request: Request) {
  const token = await readSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, hits: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  const locale = searchParams.get("locale") ?? "en";

  // Below two characters every list endpoint would match nearly everything, which is slow for
  // core-api and useless to the user.
  if (query.length < 2) return NextResponse.json({ success: true, hits: [] });

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) throw new Error("API_BASE_INTERNAL is not set.");

  const encoded = encodeURIComponent(query);
  const [groups, exercises, users] = await Promise.all([
    fetchJson(`${apiBase}/groups?search=${encoded}`, token),
    fetchJson(`${apiBase}/exercises?search=${encoded}&limit=${LIMIT}`, token),
    fetchJson(`${apiBase}/users?search=${encoded}&limit=${LIMIT}`, token),
  ]);

  const hits: SearchHit[] = [
    ...itemsOf(groups)
      .slice(0, LIMIT)
      .map((group) => ({
        id: String(group.id),
        label: localizedName(group.localizedTexts as never, locale),
        href: `/groups/${String(group.id)}`,
        kind: "group" as const,
      })),
    ...itemsOf(exercises)
      .slice(0, LIMIT)
      .map((exercise) => ({
        id: String(exercise.id),
        label: localizedName(exercise.localizedTexts as never, locale),
        href: `/exercises/${String(exercise.id)}`,
        kind: "exercise" as const,
      })),
    ...itemsOf(users)
      .slice(0, LIMIT)
      .map((user) => ({
        id: String(user.id),
        label: String(user.fullName ?? ""),
        href: `/users/${String(user.id)}`,
        kind: "user" as const,
      })),
  ].filter((hit) => hit.label !== "");

  return NextResponse.json({ success: true, hits });
}
