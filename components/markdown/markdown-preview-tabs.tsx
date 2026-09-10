"use client";

import { Children, cloneElement, isValidElement, useId, useState } from "react";
import { useTranslations } from "next-intl";

import { renderMarkdownPreview } from "@/lib/actions/markdown-preview";

/**
 * A Write/Preview pair around a markdown field (G-028) -- so an author can see what they wrote
 * before a student does. It matters most for exercise texts carrying KaTeX, where a mistyped
 * delimiter is invisible until somebody reads the assignment.
 *
 * **It wraps the caller's own field instead of replacing it.** Every form this goes into already
 * owns its textarea through `useServerActionForm`'s `register()`, so a component that took over
 * the value would mean rewriting five working forms to gain a preview. Passing the textarea as
 * `children` and the way to read it as `getSource` leaves all of that untouched: nothing here is
 * part of the form's state, and switching tabs cannot change what will be submitted.
 *
 * The preview is fetched **when the tab is opened**, not as the reader types. A debounced live
 * preview would mean a server round trip per keystroke through a markdown parser, KaTeX and
 * Shiki, for a view nobody is looking at while they type -- and the round trip is the price of
 * rendering through the real pipeline (see `renderMarkdownPreview`).
 *
 * Both panels stay mounted, with the hidden one hidden rather than unmounted: a textarea that is
 * removed from the DOM loses its scroll position, its selection and the reader's place in it.
 */
export function MarkdownPreviewTabs({
  getSource,
  children,
  id,
  "aria-describedby": describedBy,
}: {
  /** Reads the current draft. Called on each switch to Preview, never during render. */
  getSource: () => string;
  children: React.ReactNode;
  /**
   * Not set by callers. `Field` labels a control by stamping `id` and `aria-describedby` onto its
   * first element child -- which, once this component sits between the two, is this component
   * rather than the textarea. Both are therefore passed straight down to the field, so wrapping a
   * `Field`-based textarea in tabs does not silently detach it from its own label. Found by
   * `instances.spec.ts`, which stopped being able to find the field by its label.
   */
  id?: string;
  "aria-describedby"?: string;
}) {
  const t = useTranslations("MarkdownPreview");
  const baseId = useId();
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<React.ReactNode>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const childList = Children.toArray(children);
  const firstElement = childList.findIndex((child) => isValidElement(child));
  const field =
    id === undefined && describedBy === undefined
      ? children
      : childList.map((child, index) =>
          index === firstElement && isValidElement(child)
            ? cloneElement(child as React.ReactElement<Record<string, unknown>>, {
                id,
                "aria-describedby": describedBy,
              })
            : child,
        );

  const writeTabId = `${baseId}-write-tab`;
  const previewTabId = `${baseId}-preview-tab`;
  const writePanelId = `${baseId}-write`;
  const previewPanelId = `${baseId}-preview`;

  function showPreview() {
    setPreviewing(true);
    setError(null);
    const source = getSource();
    // Nothing written yet: say so rather than spending a round trip rendering an empty document
    // into an empty box, which reads as a broken preview.
    if (source.trim() === "") {
      setPreview(null);
      setPending(false);
      return;
    }
    setPending(true);
    void renderMarkdownPreview(source).then((result) => {
      setPending(false);
      if (result.success) setPreview(result.data);
      else {
        setPreview(null);
        setError(result.formError ?? t("failed"));
      }
    });
  }

  const tab = (active: boolean) =>
    `rounded-md px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"
    }`;

  return (
    <div className="flex flex-col gap-1.5">
      <div role="tablist" aria-label={t("tablist")} className="flex gap-1 self-start">
        <button
          type="button"
          role="tab"
          id={writeTabId}
          aria-selected={!previewing}
          aria-controls={writePanelId}
          onClick={() => setPreviewing(false)}
          className={tab(!previewing)}
        >
          {t("write")}
        </button>
        <button
          type="button"
          role="tab"
          id={previewTabId}
          aria-selected={previewing}
          aria-controls={previewPanelId}
          onClick={showPreview}
          className={tab(previewing)}
        >
          {t("preview")}
        </button>
      </div>

      <div role="tabpanel" id={writePanelId} aria-labelledby={writeTabId} hidden={previewing}>
        {field}
      </div>

      <div
        role="tabpanel"
        id={previewPanelId}
        aria-labelledby={previewTabId}
        hidden={!previewing}
        aria-busy={pending}
        className="min-h-24 rounded-md border border-input bg-muted/30 p-3"
      >
        {pending && <p className="text-sm text-muted-foreground">{t("rendering")}</p>}
        {!pending && error !== null && <p className="text-sm text-destructive">{error}</p>}
        {!pending && error === null && preview}
        {!pending && error === null && preview === null && (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
      </div>
    </div>
  );
}
