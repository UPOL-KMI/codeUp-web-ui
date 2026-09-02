import "server-only";

import { ApiError, apiGet } from "./client";
import { MESSAGE_TYPES, type MessageType } from "./message-types";
import { apiRead } from "./read";

/**
 * Broadcasts to everybody, or to everybody in a role (AD-007).
 *
 * **The module is called `systemMessages` and the endpoints are `/v1/notifications`.** That
 * mismatch is the legacy app's and is the reason these took finding: nothing in
 * `openapi/core-api.yaml` matches "system message", and the paths turned up in
 * `redux/modules/systemMessages.js` instead. Two endpoints, and they answer different questions:
 * `/all` is every message that exists (the management screen), `/` is the ones active *for this
 * reader right now* (what the app shell shows them).
 *
 * **`role` is a floor, not a target.** core-api's own words are "users with this role and its
 * children can see notification", so `student` reaches everybody and `superadmin` reaches only
 * administrators -- verified live, where a message addressed to `student` was returned to the
 * superadmin as well. The editor says so, because "role: student" reads like the opposite.
 */
export interface SystemMessage {
  id: string;
  authorId: string | null;
  /** One entry per locale this message was written in. */
  texts: { locale: string; text: string }[];
  type: MessageType;
  /** The lowest role that sees it; every role above sees it too. */
  role: string;
  visibleFrom: number;
  visibleTo: number;
  groupIds: string[];
}

interface MessagePayload {
  id: string;
  authorId?: string | null;
  localizedTexts?: { locale: string; text?: string }[];
  type?: string;
  role?: string;
  visibleFrom?: number;
  visibleTo?: number;
  groupsIds?: string[];
}

function message(payload: MessagePayload): SystemMessage {
  const type = MESSAGE_TYPES.find((known) => known === payload.type) ?? "info";
  return {
    id: payload.id,
    authorId: payload.authorId ?? null,
    texts: (payload.localizedTexts ?? []).map((text) => ({
      locale: text.locale,
      text: text.text ?? "",
    })),
    type,
    role: payload.role ?? "student",
    visibleFrom: payload.visibleFrom ?? 0,
    visibleTo: payload.visibleTo ?? 0,
    groupIds: payload.groupsIds ?? [],
  };
}

/** Every message there is, newest window first -- the management screen's list. */
export async function getAllSystemMessages(): Promise<SystemMessage[]> {
  const payload = await apiRead<MessagePayload[]>("/v1/notifications/all");
  return payload.map(message).sort((a, b) => b.visibleFrom - a.visibleFrom);
}

/**
 * The messages this reader should be seeing right now.
 *
 * Raw client on purpose: this is fetched by the app shell on **every** page, and a failure here
 * must not take down the page it decorates -- an unreachable broadcast is worth nothing and a
 * blank application is worth less. Returns an empty list instead, which is also what a reader with
 * no active messages gets.
 */
export async function getActiveSystemMessages(): Promise<SystemMessage[]> {
  try {
    const payload = await apiGet<MessagePayload[]>("/v1/notifications");
    return payload.map(message).sort((a, b) => b.visibleFrom - a.visibleFrom);
  } catch (error) {
    if (error instanceof ApiError) return [];
    throw error;
  }
}
