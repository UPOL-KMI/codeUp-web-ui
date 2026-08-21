import { StatusState } from "./status-state";

/**
 * The empty state (D-008). Brief §9 is specific that "empty" means "empty **with the action that
 * fills it**" -- an empty list with no next step is a dead end, so `action` is the whole point of
 * this wrapper over `StatusState` and callers are expected to pass one wherever the viewer is
 * actually permitted to create something. It stays optional because permission decides that, not
 * this component: a student looking at a group with no assignments has nothing to be offered.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return <StatusState title={title} description={description} action={action} />;
}
