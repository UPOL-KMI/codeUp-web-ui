import "server-only";

import { cache } from "react";

import { requireSession } from "@/lib/auth/require-session";

import { apiRead } from "./read";

/**
 * The signed-in user, as the app shell needs them (D-014).
 *
 * `role` lives at `privateData.role`, not at the top level -- verified against a live
 * `/v1/users/{id}` response. There is no `/users/me`: passing `me` as the id fails core-api's own
 * uuid validation (checked, not assumed), so the id comes from the session cookie's `sub` claim.
 */
export interface CurrentUser {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  /** False until the address on the account has been confirmed (A-006). */
  isVerified: boolean;
  /** The instances this account belongs to. The first is the one an administrator creating an
   *  account here puts it in (AD-001), which is the legacy app's `selectedInstanceId` restated. */
  instanceIds: string[];
  /**
   * **The role this session is acting as, which is what every gate in this app should ask.** Where
   * the reader has narrowed their session (G-023) this is that narrower role, not the account's --
   * because it is what core-api authorises against, so a screen offered on the account's role
   * would be a screen core-api then refuses. `accountRole` below is the account's own.
   */
  /** The group this user is locked into for an exam, if any (S-008). */
  groupLock: string | null;
  groupLockType: string | null;
  /** The address they are pinned to for the duration of that lock. */
  ipLock: string | null;
  /**
   * The `visibleFrom` of the newest broadcast this reader has marked as seen (AD-007). core-api has
   * no per-message read flag -- the legacy app keeps one timestamp in `uiData` and treats every
   * message older than it as read, and this is that number.
   */
  messagesReadUpTo: number | null;
  /**
   * What the account actually is, regardless of any narrowing (G-023). Only two things need it:
   * the banner that says a session is narrowed, and the control that offers to narrow it -- both
   * of which have to know the difference. Everything else wants `role`.
   */
  accountRole: string;
}

interface UserPayload {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  isVerified?: boolean;
  privateData?: {
    role?: string;
    instancesIds?: string[];
    groupLock?: string | null;
    groupLockType?: string | null;
    ipLock?: string | null;
    uiData?: { systemMessagesAccepted?: number | null } | null;
  };
}

/**
 * Wrapped in React's `cache()`, which memoizes **per request** -- not across requests, not across
 * users. This is deliberately *not* in tension with DEC-021/DEF-001's "never cache user-scoped
 * data": that rule is about a cache outliving the request and leaking one user's data to another,
 * which `cache()` cannot do (it is scoped to a single render pass). Without it, the app shell and
 * any page that also needs the current user would each issue their own `/v1/users/{id}` call on
 * every navigation -- pure duplicate round trips, and the S-series screens will all want this.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser> {
  const session = await requireSession();
  const user = await apiRead<UserPayload>("/v1/users/{id}", { pathParams: { id: session.userId } });

  const accountRole = user.privateData?.role ?? "student";

  return {
    id: user.id,
    fullName: user.fullName,
    isVerified: user.isVerified ?? true,
    instanceIds: user.privateData?.instancesIds ?? [],
    avatarUrl: user.avatarUrl,
    // The session's narrowing wins over the account's role, deliberately and app-wide (G-023):
    // core-api authorises against the token's `effrole`, so a sidebar built from the account's
    // role would offer a narrowed reader links that every click then refuses.
    role: session.effectiveRole ?? accountRole,
    accountRole,
    groupLock: user.privateData?.groupLock ?? null,
    groupLockType: user.privateData?.groupLockType ?? null,
    ipLock: user.privateData?.ipLock ?? null,
    messagesReadUpTo: user.privateData?.uiData?.systemMessagesAccepted ?? null,
  };
});

/**
 * Who sees the Admin section (`docs/IA.md` §3.1). Deliberately a role check *and* deliberately not
 * the app's authorisation boundary: core-api decides what each admin route may actually do, and
 * `requireSession()` plus core-api's own ACL checks are what enforce that (brief §3.4, "a hidden
 * button is not authorisation"). This only decides whether to render a link the user would be
 * refused at anyway.
 */
export function canSeeAdminSection(role: string): boolean {
  return role === "superadmin" || role === "empowered-supervisor";
}

/**
 * Who may make a new pipeline (G-016). A role check for the same reason as above and one more:
 * core-api's pipeline **list** carries no create hint at all -- `permissionHints` are attached per
 * pipeline by the view factory, and there is no envelope to hang a list-level one on -- so there
 * is no hint to read, and `permissions.neon` grants `pipeline.create` from `empowered-supervisor`
 * up. `actionCreatePipeline` asks its own `canCreate()` on every call, which is the boundary.
 */
export function canCreatePipeline(role: string): boolean {
  return role === "superadmin" || role === "empowered-supervisor";
}
