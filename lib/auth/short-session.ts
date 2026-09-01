import "server-only";

/**
 * How long a "short session" lasts on this deployment, in seconds -- or null where it offers none.
 *
 * The legacy app has the same idea as a `SHORT_SESSION` config var in minutes, and shows the
 * checkbox only when it is set; this reads `SHORT_SESSION_MINUTES` and does the same. It is the
 * one thing on the sign-in screen that is a deployment's choice rather than a user's: the point is
 * a shorter window of exposure on a public computer, so the *length* is not something the browser
 * gets to name. core-api caps `expiration` at its own default regardless.
 */
export function shortSessionSeconds(): number | null {
  const minutes = Number(process.env.SHORT_SESSION_MINUTES ?? "");
  return Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes) * 60 : null;
}
