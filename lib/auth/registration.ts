import "server-only";

/**
 * Whether this deployment lets people create their own accounts (A-003).
 *
 * core-api has the same switch (`localRegistration.enabled`, `LOCAL_REGISTRATION_ENABLED` in the
 * compose repo's `.env`, **false** on this one) and **publishes no endpoint that reports it** --
 * the legacy frontend carries its own `ALLOW_LOCAL_REGISTRATION` config var for exactly this
 * reason, and this is that variable. Two places to configure one fact is a wart, and it is
 * core-api's wart: a screen that offered a form and then met a 403 would be worse.
 *
 * Off unless the deployment says otherwise, because that is the safer way round: on an instance
 * that authenticates through CAS, a registration form is not merely useless, it is misleading.
 */
export function localRegistrationEnabled(): boolean {
  return process.env.ALLOW_LOCAL_REGISTRATION === "true";
}
