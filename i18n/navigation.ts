import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// Locale-aware wrappers: use these instead of next/link and next/navigation everywhere in the
// app, so links/redirects/router calls always carry the current locale automatically.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
