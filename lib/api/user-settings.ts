import "server-only";

import { cache } from "react";

import { apiRead } from "./read";

/**
 * The reader's own account, as the settings screen edits it (S-022).
 *
 * Everything here comes from `/v1/users/{id}` -- **including `settings`**, which core-api attaches
 * to `privateData` only for the user themselves (`UserViewFactory`: `reallyShowEverything ||
 * isUserLoggedInUser`). There is no endpoint that reads the settings on their own, which is why
 * this screen fetches the user rather than a settings object.
 *
 * `isLocal` decides whether a password can be changed at all: an account that signs in only
 * through an external service has no local login to change, and offering the form would be
 * offering something core-api will refuse.
 */
export interface AccountSettings {
  id: string;
  titlesBeforeName: string;
  firstName: string;
  lastName: string;
  titlesAfterName: string;
  email: string;
  isVerified: boolean;
  /** The account has a local password (as opposed to signing in only through an external service). */
  isLocal: boolean;
  /** True while a local account exists but has no password set yet. */
  emptyLocalPassword: boolean;
  gravatarUrlEnabled: boolean;
  settings: AccountNotificationSettings;
}

export interface AccountNotificationSettings {
  defaultLanguage: string;
  [flag: string]: string | boolean;
}

/** The email flags core-api accepts, in the order the legacy settings form lists them. */
export const NOTIFICATION_FLAGS = [
  "newAssignmentEmails",
  "assignmentDeadlineEmails",
  "submissionEvaluatedEmails",
  "solutionAcceptedEmails",
  "pointsChangedEmails",
  "solutionCommentsEmails",
  "assignmentCommentsEmails",
  "solutionReviewsEmails",
  "solutionReviewRequestedEmails",
  "assignmentSubmitAfterAcceptedEmails",
  "assignmentSubmitAfterReviewedEmails",
  "exerciseNotificationEmails",
] as const;

export type NotificationFlag = (typeof NOTIFICATION_FLAGS)[number];

interface UserPayload {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
  name?: {
    titlesBeforeName?: string;
    firstName?: string;
    lastName?: string;
    titlesAfterName?: string;
  };
  privateData?: {
    email?: string;
    isLocal?: boolean;
    emptyLocalPassword?: boolean;
    settings?: Record<string, string | boolean>;
  } | null;
}

export const getAccountSettings = cache(async function getAccountSettings(
  userId: string,
): Promise<AccountSettings> {
  const user = await apiRead<UserPayload>("/v1/users/{id}", { pathParams: { id: userId } });
  const settings = user.privateData?.settings ?? {};

  return {
    id: user.id,
    titlesBeforeName: user.name?.titlesBeforeName ?? "",
    firstName: user.name?.firstName ?? "",
    lastName: user.name?.lastName ?? "",
    titlesAfterName: user.name?.titlesAfterName ?? "",
    email: user.privateData?.email ?? "",
    isVerified: user.isVerified === true,
    isLocal: user.privateData?.isLocal === true,
    emptyLocalPassword: user.privateData?.emptyLocalPassword === true,
    // core-api has no `gravatarUrlEnabled` in the response; the avatar URL being set is what says
    // it is on, which is how the legacy form derives its own initial value.
    gravatarUrlEnabled: (user.avatarUrl ?? null) !== null,
    settings: {
      defaultLanguage: String(settings.defaultLanguage ?? "en"),
      ...Object.fromEntries(NOTIFICATION_FLAGS.map((flag) => [flag, settings[flag] === true])),
    },
  };
});

export interface CalendarToken {
  id: string;
  createdAt: number;
  expiredAt: number | null;
}

/**
 * The iCal tokens this user has (Q-014, parked here by S-003).
 *
 * A token is a **bearer URL**: whoever holds `/v1/users/ical/{token}` can read the person's
 * deadlines, with no other authentication -- which is the whole point of a calendar subscription,
 * and the reason this screen lists every token with its age and offers to expire it. Expiring is
 * the only way to revoke one; core-api keeps the record and marks it, rather than deleting it.
 */
export const getCalendarTokens = cache(async function getCalendarTokens(
  userId: string,
): Promise<CalendarToken[]> {
  const tokens = await apiRead<{ id: string; createdAt: number; expiredAt?: number | null }[]>(
    "/v1/users/{id}/calendar-tokens",
    { pathParams: { id: userId } },
  );

  return tokens
    .map((token) => ({
      id: token.id,
      createdAt: token.createdAt,
      expiredAt: token.expiredAt ?? null,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
});
