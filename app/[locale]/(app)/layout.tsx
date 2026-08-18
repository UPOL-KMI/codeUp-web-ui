// Shared shell for pages requiring a session (dashboard, groups, exercises, admin, ...).
// Deliberately a passthrough for now -- D-series (Design System) owns the real sidebar +
// PageShell chrome (docs/IA.md §3), and F-015 (requireSession()) owns the actual access check;
// this file is the place those tickets edit, not something to pre-build speculatively.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
