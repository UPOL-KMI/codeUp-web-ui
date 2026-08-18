// The 8 `(anon)` routes from app/[locale]/(anon)/ (F-013), reachable without a session; plus the
// bare locale root (app/[locale]/page.tsx), also public per proxy.ts's PUBLIC_PATHNAMES (F-014).
export const PUBLIC_ROUTES = [
  "",
  "/login",
  "/register",
  "/forgot-password",
  "/forgot-password/change",
  "/email-verification",
  "/accept-invitation",
  "/faq",
];

// The 10 `(app)` routes from app/[locale]/(app)/ (F-013), all requiring a session via proxy.ts.
export const APP_ROUTES = [
  "/dashboard",
  "/groups",
  "/exercises",
  "/pipelines",
  "/profile",
  "/submission-failures",
  "/system-messages",
  "/users",
  "/admin",
  "/archive",
];
