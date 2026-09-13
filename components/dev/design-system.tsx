"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";

import { DataTable } from "@/components/data-table";
import { formatPercent, formatPoints } from "@/lib/format/points";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/dialog/dialog";
import { FormError } from "@/components/form/form-error";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorBoundary } from "@/components/state/error-boundary";
import { TableSkeleton } from "@/components/state/skeleton";
import { TextField } from "@/components/form/text-field";
import { RelativeTime } from "@/components/format/relative-time";
import { DeadlineBadge } from "@/components/status/deadline-badge";
import { useToast } from "@/components/toast/toast-provider";
import { FileUpload } from "@/components/upload/file-upload";
import { Button, buttonClasses } from "@/components/button";

/**
 * The interactive half of `/dev/design-system` (D-013). Split out of the page itself so the page
 * stays a Server Component and only this island is `"use client"` -- brief §6.4's rule, which a
 * demo page has no more licence to break than a real one.
 *
 * Sample data is deliberately inert and obviously fake. Nothing here talks to core-api except the
 * upload component, which genuinely does (that's the point of having it here) and therefore only
 * works for a signed-in viewer -- called out in the section's own note rather than hidden.
 */

// Fixed timestamps, not `Date.now()` offsets: calling `Date.now()` during render is impure and
// the React compiler's lint rejects it outright (correctly -- it makes the render non-
// deterministic). Fixed values also keep this page's three deadline states stable rather than
// having one of them quietly expire.
const PAST = Date.parse("2020-01-01T00:00:00Z") / 1000;
const FUTURE = Date.parse("2100-01-01T00:00:00Z") / 1000;
// A nearer future date, so the relative-time sample reads like something a real deadline would
// ("in 5 years" is technically correct and demonstrates nothing).
const FUTURE_DEADLINE = Date.parse("2026-09-01T21:59:00Z") / 1000;

interface DemoRow {
  id: string;
  name: string;
  points: number;
  deadline: string;
}

const DEMO_ROWS: DemoRow[] = [
  { id: "1", name: "Fibonacci", points: 10, deadline: "2026-09-01" },
  { id: "2", name: "Binary search", points: 15, deadline: "2026-09-08" },
  { id: "3", name: "Hash table", points: 25, deadline: "2026-09-15" },
  { id: "4", name: "Graph traversal", points: 20, deadline: "2026-09-22" },
  { id: "5", name: "Dynamic programming", points: 30, deadline: "2026-09-29" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function DesignSystemShowcase({
  codeSample,
  markdownSample,
  evaluationBadges,
  evaluationTable,
  dateSamples,
}: {
  codeSample: React.ReactNode;
  markdownSample: React.ReactNode;
  evaluationBadges: React.ReactNode;
  evaluationTable: React.ReactNode;
  dateSamples: React.ReactNode;
}) {
  const t = useTranslations("DesignSystem");
  const status = useTranslations("Status");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCount, setConfirmCount] = useState(0);
  const form = useForm<{ email: string }>({ defaultValues: { email: "" } });
  const toast = useToast();
  const [panelBroken, setPanelBroken] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Section title={t("tokens")}>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["background", "bg-background text-foreground border-border"],
              ["card", "bg-card text-card-foreground border-border"],
              ["primary", "bg-primary text-primary-foreground border-transparent"],
              ["secondary", "bg-secondary text-secondary-foreground border-transparent"],
              ["muted", "bg-muted text-muted-foreground border-transparent"],
              ["accent", "bg-accent text-accent-foreground border-transparent"],
              ["destructive", "bg-destructive text-destructive-foreground border-transparent"],
            ] as const
          ).map(([name, classes]) => (
            <span
              key={name}
              className={`rounded-md border px-3 py-1.5 font-mono text-sm ${classes}`}
            >
              {name}
            </span>
          ))}
        </div>
      </Section>

      <Section title={t("buttons")}>
        <p className="text-sm text-muted-foreground">{t("buttonsNote")}</p>
        <div className="flex flex-col gap-3">
          {(["md", "sm", "xs"] as const).map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-2">
              {(
                [
                  "primary",
                  "outline",
                  "ghost",
                  "destructive",
                  "destructive-outline",
                  "warning-outline",
                ] as const
              ).map((variant) => (
                <Button key={variant} variant={variant} size={size}>
                  {variant}
                </Button>
              ))}
              <Button size={size} disabled>
                disabled
              </Button>
            </div>
          ))}
        </div>
      </Section>
      <Section title={t("dataTable")}>
        <DataTable<DemoRow>
          id="ks"
          data={DEMO_ROWS}
          getRowId={(row) => row.id}
          pageSize={3}
          selectable
          columns={[
            { id: "name", header: t("columnName"), cell: (row) => row.name, sortable: true },
            {
              id: "points",
              header: t("columnPoints"),
              cell: (row) => row.points,
              sortValue: (row) => row.points,
              sortable: true,
            },
            {
              id: "deadline",
              header: t("columnDeadline"),
              cell: (row) => row.deadline,
              sortable: true,
            },
          ]}
        />
      </Section>

      <Section title={t("form")}>
        <FormProvider {...form}>
          <div className="flex max-w-sm flex-col gap-3">
            <FormError />
            <TextField<{ email: string }>
              name="email"
              label={t("fieldEmail")}
              type="email"
              description={t("fieldEmailHint")}
            />
            <button
              type="button"
              onClick={() => {
                form.setError("email", { message: t("demoFieldError") });
                form.setError("root", { message: t("demoFormError") });
              }}
              className={buttonClasses("outline", "sm", "self-start")}
            >
              {t("showErrors")}
            </button>
          </div>
        </FormProvider>
      </Section>

      <Section title={t("dialogs")}>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog>
            <DialogTrigger className="rounded-md border border-input px-3 py-1.5 text-sm">
              {t("openDialog")}
            </DialogTrigger>
            <DialogContent title={t("dialogTitle")} description={t("dialogDescription")}>
              <DialogFooter>
                <DialogClose className="rounded-md border border-input px-3 py-1.5 text-sm">
                  {t("dialogClose")}
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className={buttonClasses("outline", "sm")}
          >
            {t("openConfirm")}
          </button>
          {confirmCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {t("confirmedTimes", { count: confirmCount })}
            </span>
          )}
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={t("confirmTitle")}
            description={t("confirmDescription")}
            onConfirm={() => setConfirmCount((count) => count + 1)}
          />
        </div>
      </Section>

      <Section title={t("code")}>
        <p className="text-sm text-muted-foreground">{t("codeNote")}</p>
        {codeSample}
      </Section>

      <Section title={t("formatters")}>
        <p className="text-sm text-muted-foreground">{t("formattersNote")}</p>
        <div className="flex flex-wrap items-center gap-4 text-sm">{dateSamples}</div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <RelativeTime unixSeconds={FUTURE_DEADLINE} />
          <RelativeTime unixSeconds={PAST} />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span>{formatPoints(7, 10)}</span>
          <span>{formatPoints(7)}</span>
          <span>{formatPercent(0.996)}</span>
          <span>{formatPercent(1)}</span>
        </div>
      </Section>

      <Section title={t("badges")}>
        <p className="text-sm text-muted-foreground">{t("badgesNote")}</p>
        <div className="flex flex-wrap gap-2">{evaluationBadges}</div>
        <div className="flex flex-wrap gap-2">
          <DeadlineBadge firstDeadline={FUTURE} />
          <DeadlineBadge firstDeadline={PAST} secondDeadline={FUTURE} allowSecondDeadline />
          <DeadlineBadge firstDeadline={PAST} />
        </div>
      </Section>

      <Section title={t("evaluationTable")}>
        <p className="text-sm text-muted-foreground">{t("evaluationTableNote")}</p>
        {evaluationTable}
      </Section>

      <Section title={t("markdown")}>
        <p className="text-sm text-muted-foreground">{t("markdownNote")}</p>
        {markdownSample}
      </Section>

      <Section title={t("states")}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t("stateLoading")}</p>
            <TableSkeleton rows={3} columns={3} label={status("loading")} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t("stateEmpty")}</p>
            <EmptyState
              title={t("stateEmptyTitle")}
              description={t("stateEmptyBody")}
              action={
                <button type="button" className={buttonClasses("primary", "sm")}>
                  {t("stateEmptyAction")}
                </button>
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t("stateError")}</p>
            <button
              type="button"
              onClick={() => setPanelBroken(true)}
              className={buttonClasses("outline", "sm", "self-start")}
            >
              {t("stateBreakIt")}
            </button>
            {/* The boundary is what's on show: only this panel fails, the rest of the page (and
                the toast/dialog state above it) keeps working. `retry()` re-renders the children,
                so the reset below is what makes the panel recoverable in this demo. */}
            <button
              type="button"
              onClick={() => setPanelBroken(false)}
              className={buttonClasses("outline", "sm", "self-start")}
            >
              {t("stateFixIt")}
            </button>
            <ErrorBoundary>
              <FailingPanel broken={panelBroken} />
            </ErrorBoundary>
          </div>
        </div>
      </Section>

      <Section title={t("toasts")}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => toast.success(t("toastSuccessTitle"), t("toastSuccessBody"))}
            className={buttonClasses("outline", "sm")}
          >
            {t("showSuccessToast")}
          </button>
          <button
            type="button"
            onClick={() => toast.error(t("toastErrorTitle"), t("toastErrorBody"))}
            className={buttonClasses("outline", "sm")}
          >
            {t("showErrorToast")}
          </button>
        </div>
      </Section>

      <Section title={t("upload")}>
        <p className="text-sm text-muted-foreground">{t("uploadNote")}</p>
        <FileUpload />
      </Section>
    </div>
  );
}

/**
 * Demo-only. Throws while `broken` is true, and keeps throwing on `retry()` -- which is exactly
 * what a genuinely broken panel does, and worth showing honestly rather than faking a recovery.
 * Press "repair", then "try again", to watch the boundary actually recover: `retry()` re-renders
 * these children, so it succeeds as soon as the underlying cause is gone.
 */
function FailingPanel({ broken }: { broken: boolean }) {
  const t = useTranslations("DesignSystem");
  if (broken) throw new Error(t("stateBoom"));
  return (
    <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
      {t("stateBoom")}
    </div>
  );
}
