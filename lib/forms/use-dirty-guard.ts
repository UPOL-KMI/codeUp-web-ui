"use client";

import { useEffect } from "react";

const DEFAULT_MESSAGE = "You have unsaved changes. Leave anyway?";

/**
 * Warns before the user loses unsaved form input (BACKLOG.md D-004: "dirty guard"). Covers a full
 * page unload -- tab close, refresh, typing a new URL, following a link to another *origin* --
 * via the browser-native `beforeunload` event, gated on RHF's own `formState.isDirty`.
 *
 * **Does not intercept in-app client-side navigation** (clicking a `next/link` `Link` to another
 * route within this app). This isn't a shortcut -- checked the currently bundled Next.js docs
 * (`node_modules/next/dist/docs/`) for a navigation-blocking primitive (the equivalent of React
 * Router's `useBlocker`/`unstable_usePrompt`) and found none; the App Router has no documented,
 * supported hook for this as of 16.3. A custom click-interceptor (capturing clicks on internal
 * links and confirming before calling the router) is possible but fragile -- it has to rediscover
 * every way a navigation can start (Link clicks, programmatic `router.push`, browser back/forward)
 * and stays permanently out of sync with any of them Next.js changes. Left as a known, documented
 * gap rather than building something brittle to check a box; a future ticket should revisit this
 * only if a real form actually needs it and the App Router has since grown a supported primitive.
 */
export function useDirtyGuard(isDirty: boolean, message: string = DEFAULT_MESSAGE): void {
  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Modern browsers ignore this string and show their own generic prompt, but setting it is
      // still required for the confirmation dialog to appear at all in the first place.
      event.returnValue = message;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, message]);
}
