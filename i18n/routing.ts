import { defineRouting } from "next-intl/routing";

// Both locales are equally first-class (brief: "Czech and English, both complete, always") --
// localePrefix defaults to "always" (next-intl's own default), so neither locale gets an
// unprefixed "default" URL that implicitly outranks the other. "/" redirects to whichever
// locale proxy.ts detects.
export const routing = defineRouting({
  locales: ["en", "cs"],
  defaultLocale: "en",
});
