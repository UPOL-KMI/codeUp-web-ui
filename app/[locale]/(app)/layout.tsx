import { AppShell } from "@/components/app-shell/app-shell";

// Shared shell for pages requiring a session (dashboard, groups, exercises, admin, ...). Was a
// deliberate passthrough until D-014 -- this is the file the sidebar ticket was always meant to
// fill in. The access check still lives in requireSession() at the data layer (F-015), not here:
// AppShell calls it transitively by fetching the current user, but a layout is not an
// authorisation boundary and nothing should start treating it as one.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
