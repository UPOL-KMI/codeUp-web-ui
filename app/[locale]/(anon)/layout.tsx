// Shared shell for pages reachable without a session (login, register, password reset, FAQ, ...).
// Deliberately a passthrough for now -- D-series (Design System) owns the actual centered-card
// chrome; this file is the place a later ticket edits, not something to pre-build speculatively.
export default function AnonLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
