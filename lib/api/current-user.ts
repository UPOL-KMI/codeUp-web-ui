import "server-only";

import { requireSession } from "@/lib/auth/require-session";

import { apiGet } from "./client";

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
}

interface UserPayload {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  privateData?: { role?: string };
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await requireSession();
  const user = await apiGet<UserPayload>("/v1/users/{id}", { pathParams: { id: session.userId } });

  return {
    id: user.id,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    role: user.privateData?.role ?? "student",
  };
}

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
