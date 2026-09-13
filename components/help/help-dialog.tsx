"use client";

import { useTranslations } from "next-intl";

import { Dialog, DialogContent, DialogTrigger } from "@/components/dialog/dialog";

/**
 * A help document, opened beside the form it explains.
 *
 * **The document is rendered on the server and handed in as children.** `Markdown` is a Server
 * Component -- it runs Shiki and KaTeX -- so it cannot be imported from a `"use client"` module;
 * passing the already-rendered tree in as `children` is how a client shell wraps server content,
 * and it means the help costs the browser no parser, no highlighter and no second request.
 *
 * Wider and scrollable, unlike D-006's confirm dialogs: this is a document rather than a question,
 * and the tables in it need the room -- at the dialog's ordinary width a two-column table of field
 * names and explanations wrapped every cell onto four lines.
 *
 * Everything else about it -- focus trapping, `Escape`, restoring focus to the button that opened
 * it -- is Radix's, through the same primitive the rest of the app uses.
 *
 * Asked for by the operator on the test configuration screen, which is the screen a new teacher
 * meets first and understands last.
 */
export function HelpDialog({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTranslations("Help");

  return (
    <Dialog>
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <circle cx="10" cy="10" r="7.5" />
          <path d="M7.8 7.6a2.2 2.2 0 1 1 2.7 2.2v1.4" strokeLinecap="round" />
          <path d="M10.5 14.2h.01" strokeLinecap="round" />
        </svg>
        {t("open")}
      </DialogTrigger>
      {/* The width is a style rather than a `max-w-*` class on purpose: `DialogContent`'s own
          `max-w-lg` and a wider utility are both `max-width` rules, and which one wins is decided
          by Tailwind's stylesheet order, not by the order they appear in the class list -- measured,
          the dialog stayed 498px wide. An inline style has nothing to argue with. */}
      <DialogContent
        title={title}
        className="max-h-[85vh] overflow-y-auto"
        style={{ maxWidth: "min(64rem, calc(100vw - 2rem))" }}
      >
        <div className="text-sm">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
