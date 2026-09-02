/**
 * The four kinds of system message core-api accepts (AD-007), and what each looks like on screen.
 *
 * Deliberately **not** in `./system-messages.ts`, which is `server-only`: the editor that offers
 * these is a client component and the Zod schema they validate against is shared with a Server
 * Action, so a `server-only` import would reach `"use client"` and fail the build -- which is
 * exactly how this file came to exist, the second time (`./user-roles.ts` was the first).
 *
 * core-api calls the field "type of the notification (custom)" and validates nothing, so this list
 * is the legacy editor's four options rather than an enum the API enforces.
 */
export const MESSAGE_TYPES = ["success", "info", "warning", "danger"] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];
