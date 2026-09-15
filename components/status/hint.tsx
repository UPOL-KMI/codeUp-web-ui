"use client";

import { Tooltip } from "radix-ui";

/**
 * A short explanation attached to something on screen, shown **immediately** on hover or focus.
 *
 * Replaces the native `title` attribute, which the operator rightly called useless here: browsers
 * hold it back for a second or two, draw it in the system's own style, and never show it to a
 * keyboard at all. `delayDuration={0}` is the whole point of this component.
 *
 * The trigger keeps whatever it wraps: `asChild` means no extra element in the layout, and the
 * child stays whatever it was -- a badge, a label, a word.
 */
export function Hint({
  text,
  plain = false,
  children,
}: {
  text: string;
  /**
   * Drop the dotted underline. For a child that is already its own affordance -- a badge -- where
   * a rule drawn under a pill reads as damage rather than as an invitation. The cursor still says
   * there is something to read.
   */
  plain?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Provider delayDuration={0} skipDelayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            className={`cursor-help outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              plain ? "inline-flex" : "underline decoration-dotted underline-offset-4"
            }`}
            tabIndex={0}
          >
            {children}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            collisionPadding={8}
            className="z-50 max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
          >
            {text}
            <Tooltip.Arrow className="fill-border" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
