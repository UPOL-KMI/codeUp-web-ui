import "server-only";

import { requireSession } from "@/lib/auth/require-session";
import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import { apiGet } from "./client";

/**
 * The two group lists the sidebar shows (`docs/IA.md` §3.1: "My Groups" and "My Teaching").
 *
 * `GET /v1/users/{id}/groups` returns them already split into `student` and `supervisor` -- which
 * matters, because the IA is explicit that these sections derive from **per-group membership**,
 * not from the global role, and that they are not mutually exclusive: someone who supervises one
 * course while taking another sees both. Core-api filters archived groups out of both lists
 * itself (confirmed in `UsersPresenter::actionGroups`), so the sidebar does not need to.
 */
export interface SidebarGroup {
  id: string;
  name: string;
}

interface GroupPayload {
  id: string;
  localizedTexts?: LocalizedText[];
}

export async function getMyGroups(
  locale: string,
): Promise<{ member: SidebarGroup[]; teaching: SidebarGroup[] }> {
  const session = await requireSession();
  const payload = await apiGet<{ student?: GroupPayload[]; supervisor?: GroupPayload[] }>(
    "/v1/users/{id}/groups",
    { pathParams: { id: session.userId } },
  );

  const toSidebarGroup = (group: GroupPayload): SidebarGroup => ({
    id: group.id,
    name: localizedName(group.localizedTexts, locale),
  });

  return {
    member: (payload.student ?? []).map(toSidebarGroup),
    teaching: (payload.supervisor ?? []).map(toSidebarGroup),
  };
}
