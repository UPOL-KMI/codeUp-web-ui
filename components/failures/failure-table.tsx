"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { resolveSubmissionFailure } from "@/lib/actions/submission-failure";
import type { SubmissionFailure } from "@/lib/api/submission-failures";

import { Link, useRouter } from "@/i18n/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Dialog, DialogContent, DialogFooter } from "@/components/dialog/dialog";
import { RelativeTime } from "@/components/format/relative-time";
import { Badge } from "@/components/status/badge";
import { useToast } from "@/components/toast/toast-provider";

/**
 * The failures themselves, and the one thing that can be done about them (T-019).
 *
 * The type is a badge with core-api's own meaning behind it -- a broker rejection and a
 * configuration that will not compile are different problems for different people, and the legacy
 * screen distinguishes them only by an icon with a tooltip.
 *
 * A row links to the solution it happened to, where this app has a screen for it. **A reference
 * solution's does not**: T-011 has not built that screen, and a link to a route that does not
 * exist is worse than none (DEC-066) -- Next prefetches every visible link, so it would 404 from
 * here on every render.
 *
 * Resolving takes a note and closes the row for good, so it is a dialog with a typed note rather
 * than a button that fires on one click: core-api has no un-resolve.
 */
export function FailureTable({ failures }: { failures: SubmissionFailure[] }) {
  const t = useTranslations("SubmissionFailures");
  const router = useRouter();
  const toast = useToast();
  const [resolving, setResolving] = useState<SubmissionFailure | null>(null);
  const [note, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [pending, setPending] = useState(false);

  async function resolve() {
    if (!resolving) return;
    setPending(true);
    const result = await resolveSubmissionFailure(resolving.id, { note: note.trim(), sendEmail });
    setPending(false);
    if (!result.success) {
      toast.error(t("errors.resolveFailed"), result.formError);
      return;
    }
    setResolving(null);
    setNote("");
    setSendEmail(false);
    toast.success(t("resolved"));
    router.refresh();
  }

  const columns: DataTableColumn<SubmissionFailure>[] = [
    {
      id: "type",
      header: t("columns.type"),
      sortable: true,
      sortValue: (failure) => failure.type,
      filterValue: (failure) => t(`types.${failure.type}.label`),
      cell: (failure) => (
        <Badge
          tone={failure.resolvedAt === null ? "danger" : "neutral"}
          title={t(`types.${failure.type}.description`)}
        >
          {t(`types.${failure.type}.label`)}
        </Badge>
      ),
    },
    {
      id: "description",
      header: t("columns.description"),
      className: "max-w-md",
      filterValue: (failure) => failure.description,
      cell: (failure) => <span className="text-xs">{failure.description}</span>,
    },
    {
      id: "what",
      header: t("columns.what"),
      cell: (failure) =>
        failure.solutionId !== null ? (
          <Link
            href={`/solutions/${failure.solutionId}`}
            className="whitespace-nowrap hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("what.solution")}
          </Link>
        ) : failure.referenceSolutionId !== null ? (
          <span className="whitespace-nowrap text-muted-foreground">
            {t("what.referenceSolution")}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "created",
      header: t("columns.created"),
      sortable: true,
      sortValue: (failure) => failure.createdAt,
      cell: (failure) => <RelativeTime unixSeconds={failure.createdAt} />,
    },
    {
      id: "state",
      header: t("columns.state"),
      sortable: true,
      sortValue: (failure) => failure.resolvedAt ?? 0,
      // The note is the only free text anybody types on this screen, so it is worth finding: what
      // was done about the worker last week is exactly what somebody comes back looking for.
      filterValue: (failure) =>
        `${failure.resolvedAt === null ? t("state.unresolved") : t("state.resolved")} ${failure.resolutionNote}`,
      cell: (failure) =>
        failure.resolvedAt === null ? (
          <Badge tone="warning">{t("state.unresolved")}</Badge>
        ) : (
          <span className="flex flex-col gap-0.5">
            <Badge tone="success">{t("state.resolved")}</Badge>
            {failure.resolutionNote && (
              <span className="text-xs text-muted-foreground">{failure.resolutionNote}</span>
            )}
          </span>
        ),
    },
    {
      id: "resolve",
      header: "",
      cell: (failure) =>
        failure.resolvedAt === null ? (
          <button
            type="button"
            onClick={() => setResolving(failure)}
            className="rounded-md border border-input px-2 py-1 text-xs whitespace-nowrap hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("resolve")}
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable
        id="failures"
        columns={columns}
        data={failures}
        getRowId={(failure) => failure.id}
        caption={t("caption")}
        filterPlaceholder={t("filterPlaceholder")}
      />

      <Dialog open={resolving !== null} onOpenChange={(open) => !open && setResolving(null)}>
        <DialogContent title={t("resolveDialog.title")} description={t("resolveDialog.explain")}>
          <div className="flex flex-col gap-3 text-sm">
            <p className="rounded-md border border-border bg-muted/40 p-3 text-xs">
              {resolving?.description}
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="failure-note" className="font-medium">
                {t("resolveDialog.note")}
              </label>
              <input
                id="failure-note"
                value={note}
                maxLength={255}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("resolveDialog.notePlaceholder")}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={sendEmail}
                onChange={(event) => setSendEmail(event.target.checked)}
              />
              <span className="flex flex-col gap-0.5">
                <span>{t("resolveDialog.sendEmail")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("resolveDialog.sendEmailHint")}
                </span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setResolving(null)}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("resolveDialog.cancel")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void resolve()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            >
              {t("resolveDialog.confirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
