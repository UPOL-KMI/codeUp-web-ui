import { NextResponse } from "next/server";
import { z } from "zod";

const checkSchema = z.object({
  email: z.string(),
  password: z.string(),
});

/**
 * Whether an address is free and how strong a password is (A-003), in one call.
 *
 * core-api's `users/validate-registration-data` answers both, needs no session and is not gated by
 * whether registration is open -- so the form can tell somebody their address is already taken
 * *before* they fill in the rest, which is the difference between a hint and a rejection.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = checkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ emailIsFree: null, score: null }, { status: 400 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const apiResponse = await fetch(`${apiBase}/users/validate-registration-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
  }).catch(() => null);

  if (!apiResponse?.ok) return NextResponse.json({ emailIsFree: null, score: null });

  const { payload } = (await apiResponse.json()) as {
    payload?: { usernameIsFree?: boolean; passwordScore?: number };
  };
  return NextResponse.json({
    emailIsFree: payload?.usernameIsFree ?? null,
    score: payload?.passwordScore ?? null,
  });
}
