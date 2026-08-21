"use client";

import { Dialog as RadixDialog } from "radix-ui";
import { useTranslations } from "next-intl";

/**
 * The dialog/modal system (D-006), on Radix's `Dialog` primitive -- brief §9's quality bar names
 * Radix specifically for "anything with focus semantics", and a modal is the canonical case:
 * focus trapping, focus restoration to the trigger on close, `Escape` and outside-click dismissal,
 * `aria-modal` plus the title/description wiring, and inert-ing the rest of the page are each
 * individually easy to get subtly wrong and collectively not worth hand-rolling.
 *
 * Imported from the unified `radix-ui` package rather than `@radix-ui/react-dialog`: this repo
 * will need several more primitives before the Design System phase closes (D-007 toasts, D-015's
 * command palette, dropdown/tooltip/tabs across the app), and the unified package keeps them all
 * on one version that moves together instead of a dozen independently-drifting ranges. Verified
 * installable and React 19-compatible first (`radix-ui@1.6.7`, peer `react: ^19.0`) rather than
 * assumed, per DEC-050's lesson.
 *
 * These are thin styled re-exports, not a new component API: callers compose
 * `Dialog`/`DialogTrigger`/`DialogContent` exactly as they would Radix's own, so nothing here has
 * to be re-learned from Radix's documentation, and no prop of theirs is hidden behind a narrower
 * signature this file would then have to widen ticket by ticket.
 */

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

// `title` is omitted from the underlying props before being re-declared below: the DOM's own
// `title` attribute is a `string` (the hover tooltip), so a `ReactNode` title is a genuine type
// conflict rather than a widening. A dialog whose accessible name is a hover tooltip would be a
// bug anyway, so nothing here goes out of its way to keep that attribute reachable.
export interface DialogContentProps extends Omit<
  React.ComponentPropsWithoutRef<typeof RadixDialog.Content>,
  "title"
> {
  /**
   * Required, and rendered into `Dialog.Title` -- a modal with no accessible name is announced as
   * nothing at all. Required in the type rather than left to each caller's discipline: this
   * version of Radix no longer warns about a missing title (checked, not assumed: the installed
   * `@radix-ui/react-dialog@1.1.23` contains no `console` calls whatsoever, unlike the versions
   * whose title/description console errors are widely documented), so a forgotten title would now
   * fail silently and inaccessibly rather than loudly.
   */
  title: React.ReactNode;
  /**
   * Optional supporting text. Note that the `aria-describedby={undefined}` incantation every older
   * Radix guide prescribes for a description-less dialog is **not** needed here: 1.1.23 sets
   * `aria-describedby` to `context.descriptionPresent ? context.descriptionId : undefined`, i.e.
   * it already omits the attribute when no `Dialog.Description` was rendered (read out of the
   * installed `dist/index.js`). Copying that workaround in from memory would be harmless but
   * misleading -- and it is exactly the class of stale-by-a-version detail this project keeps
   * getting bitten by.
   */
  description?: React.ReactNode;
  /** Hides the corner close button for dialogs that must be resolved by an explicit choice. */
  hideCloseButton?: boolean;
}

export function DialogContent({
  title,
  description,
  hideCloseButton,
  children,
  className,
  ...props
}: DialogContentProps) {
  const t = useTranslations("Dialog");

  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in"
      />
      <RadixDialog.Content
        data-slot="dialog-content"
        className={`fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-background p-6 shadow-lg outline-none data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in ${className ?? ""}`}
        {...props}
      >
        <div className="flex flex-col gap-1.5">
          <RadixDialog.Title className="text-lg font-semibold text-foreground">
            {title}
          </RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="text-sm text-muted-foreground">
              {description}
            </RadixDialog.Description>
          ) : null}
        </div>

        {children}

        {!hideCloseButton && (
          <RadixDialog.Close
            aria-label={t("close")}
            className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </RadixDialog.Close>
        )}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

/** Right-aligned action row; the conventional place for a dialog's confirm/cancel pair. */
export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2">{children}</div>;
}
