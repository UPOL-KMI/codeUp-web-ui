/**
 * The five roles core-api knows, lowest to highest (`permissions.neon`'s own hierarchy: each
 * inherits the one before it, and `superadmin` stands apart with a blanket allow).
 *
 * Deliberately **not** in `./users.ts`, which is `server-only`: this list is vocabulary rather than
 * data, and it is needed on both sides -- the directory's filter and the role form on the server,
 * the Zod schema those forms share with their Server Actions on the client (D-004). A
 * `server-only` import reaching a `"use client"` module fails the build, which is the right
 * failure and the reason this file exists.
 *
 * The ordering is load-bearing where it is rendered as a list: it is the order the legacy app
 * lists roles in, weakest first.
 */
export const USER_ROLES = [
  "student",
  "supervisor-student",
  "supervisor",
  "empowered-supervisor",
  "superadmin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(role: string | undefined): role is UserRole {
  return USER_ROLES.some((known) => known === role);
}
