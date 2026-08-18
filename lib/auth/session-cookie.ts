// Name only, for now. proxy.ts (F-014) only needs to check the session cookie's *presence* for
// its UX redirect (brief §5: "proxy.ts is not a security boundary"). The actual Set-Cookie --
// attributes, the conditional `secure` flag, `sessionCookieOptions()` -- lands with the login
// Route Handler (F-016). One shared constant so the two can't quietly drift apart.
export const SESSION_COOKIE_NAME = `${process.env.SESSION_COOKIE_PREFIX ?? "recodex"}_session`;
