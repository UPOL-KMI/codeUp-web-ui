import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  establishSession,
  isSessionTokenLive,
  ORIGIN_COOKIE_NAME,
} from "@/lib/auth/session-cookie";

/**
 * Back to one's own account after a takeover (PF-025).
 *
 * The counterpart to `takeover/[userId]`, which stashed the administrator's own token before
 * replacing it. Nothing here asks core-api anything: the token being restored is one core-api
 * issued to this same browser minutes ago, and it is presented on the next real call the way any
 * session token is -- core-api remains the authority on whether it still accepts it.
 *
 * **POST, and the stash is cleared whatever happens.** A stale stash is worth nothing and worth
 * less than nothing if it lingers, so the cookie goes even when the token in it turns out to be
 * dead -- in which case the caller is told to sign in, rather than left holding a session that
 * silently is not theirs.
 */
export async function POST() {
  const cookieStore = await cookies();
  const origin = cookieStore.get(ORIGIN_COOKIE_NAME)?.value;
  cookieStore.delete(ORIGIN_COOKIE_NAME);

  if (!origin || !isSessionTokenLive(origin) || !(await establishSession(origin))) {
    return NextResponse.json(
      { success: false, message: "No account to return to." },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
