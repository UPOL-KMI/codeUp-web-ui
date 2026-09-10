import * as z from "zod/mini";

import { USER_ROLES } from "@/lib/api/user-roles";

/**
 * A new account, as an administrator fills it in from the user list (AD-001). Its own module apart
 * from the `"use server"` file (D-004), so the form and the action that re-validates it share one
 * definition.
 *
 * The rules are core-api's `RegistrationPresenter::actionCreateAccount`, restated: both names at
 * least two characters (`VString(2)`), a real email, and the password typed twice -- core-api
 * compares them itself and answers `400-102` when they differ, which is a round trip to learn
 * something the form already knows.
 */
export const createUserSchema = z
  .object({
    firstName: z.string().check(z.trim(), z.minLength(2, "tooShort")),
    lastName: z.string().check(z.trim(), z.minLength(2, "tooShort")),
    email: z.string().check(z.trim(), z.email("invalidEmail")),
    password: z.string().check(z.minLength(1, "required")),
    passwordConfirm: z.string().check(z.minLength(1, "required")),
    /** Sent on the second attempt, once the administrator has seen who else has that name. */
    ignoreNameCollision: z.boolean(),
  })
  .check(
    z.refine((values) => values.password === values.passwordConfirm, {
      path: ["passwordConfirm"],
      message: "mismatch",
    }),
  );

export type CreateUserValues = z.infer<typeof createUserSchema>;

/**
 * The role an administrator assigns (AD-002). core-api validates the name itself and answers
 * `400 Unknown user role` for anything else (verified live), so this is that list restated once,
 * from the same constant the directory's filter uses.
 */
export const userRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export type UserRoleValues = z.infer<typeof userRoleSchema>;
