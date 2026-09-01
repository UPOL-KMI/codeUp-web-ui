import { NextResponse } from "next/server";
import { z } from "zod";

const strengthSchema = z.object({ password: z.string() });

/**
 * How strong a password core-api thinks it is (A-005, and A-003 when registration lands).
 *
 * core-api runs zxcvbn and answers a score from 0 to 4; the legacy app refuses to submit anything
 * scoring 0 and shows the rest as a meter. This is a plain proxy for that one endpoint, which
 * needs no session -- it exists so the browser never has to know where core-api is, and so the
 * password is not sent anywhere this app does not already send it.
 *
 * A failure answers `null` rather than an error: a strength meter that cannot be drawn is not a
 * reason to stop somebody changing their password.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = strengthSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ score: null }, { status: 400 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const apiResponse = await fetch(`${apiBase}/forgotten-password/validate-password-strength`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: parsed.data.password }),
  }).catch(() => null);

  if (!apiResponse?.ok) return NextResponse.json({ score: null });

  const { payload } = (await apiResponse.json()) as { payload?: { passwordScore?: number } };
  return NextResponse.json({ score: payload?.passwordScore ?? null });
}
