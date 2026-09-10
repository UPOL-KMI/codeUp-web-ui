"use client";

import { useId, useState } from "react";
import { FormProvider } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";

import { deleteReviewComment, updateReviewComment } from "@/lib/actions/solution-review";
import { type ReviewCommentValues } from "@/lib/actions/solution-review.schema";
import type { ReviewComment } from "@/lib/api/solution-review";
import { DATE_TIME_FORMAT } from "@/lib/format/date-time";
import type { ActionResult } from "@/lib/forms/action-result";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { FormError } from "@/components/form/form-error";
import { Badge } from "@/components/status/badge";
import { useToast } from "@/components/toast/toast-provider";

/**
 * One review comment, and the form that writes one (S-018).
 *
 * **The body is markdown and is rendered on the server, not here (G-027).** A reviewer's
 * emphasis, lists, links and fenced snippets arrived as literal asterisks and backticks until this
 * ticket, and the obvious fix -- `<Markdown source={...} />` in place of the `<p>` -- is not
 * available: `Markdown` is `async`, which only a Server Component may be, and every component on
 * the review path is a client island because a comment thread has to appear *between* two lines of
 * code. So the page renders one `<Markdown>` per comment and passes them down as `body`, and every
 * write here already calls `router.refresh()`, which re-runs that render -- there is no state in
 * which a comment is on screen without its body having been through it.
 *
 * The form serves both "new" and "edit" -- they differ only in which action they call, and having
 * one component means the issue flag and the notification suppressor cannot drift apart between
 * the two. `suppressNotification` is offered **only while the review is closed**, because that is
 * the only state in which core-api sends the author an email for an edit; showing it otherwise
 * would be a control with no effect.
 *
 * After any successful write the router is refreshed rather than the comment being patched into
 * local state: the server render is the single source of truth for what the review contains, and
 * closing a review changes what other people may see (`visibleReviewComments()`).
 */
export interface ReviewCommentFormProps {
  submitLabel: string;
  reviewClosed: boolean;
  defaultValues?: Partial<ReviewCommentValues>;
  onCancel: () => void;
  onSubmitValues: (values: ReviewCommentValues) => Promise<ActionResult<{ id: string }>>;
  onDone: () => void;
}

export function ReviewCommentForm({
  submitLabel,
  reviewClosed,
  defaultValues,
  onCancel,
  onSubmitValues,
  onDone,
}: ReviewCommentFormProps) {
  const t = useTranslations("Review");
  const router = useRouter();
  const textId = useId();

  const { form, onSubmit, isPending } = useServerActionForm<ReviewCommentValues, { id: string }>({
    schema: () =>
      import("@/lib/actions/solution-review.schema").then((module) => module.reviewCommentSchema),
    defaultValues: {
      text: defaultValues?.text ?? "",
      issue: defaultValues?.issue ?? false,
      suppressNotification: defaultValues?.suppressNotification ?? false,
    },
    action: onSubmitValues,
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });

  const {
    register,
    formState: { errors },
  } = form;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 p-3">
        <label htmlFor={textId} className="sr-only">
          {t("comment.text")}
        </label>
        <textarea
          id={textId}
          rows={3}
          autoFocus
          placeholder={t("comment.placeholder")}
          aria-invalid={errors.text ? true : undefined}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-sans text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          {...register("text")}
        />
        {errors.text?.message && (
          <p className="text-sm text-destructive">{t("comment.textRequired")}</p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" {...register("issue")} />
            {t("comment.issue")}
          </label>
          {reviewClosed && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" {...register("suppressNotification")} />
              {t("comment.suppressNotification")}
            </label>
          )}
        </div>
        <FormError />
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
          >
            {submitLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("comment.cancel")}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}

export function ReviewCommentItem({
  solutionId,
  comment,
  body,
  canModify,
  reviewClosed,
}: {
  solutionId: string;
  comment: ReviewComment;
  /**
   * The comment's text, rendered as the markdown it is authored in (G-027). Built on the server
   * and handed down, because `Markdown` is an async Server Component and everything on this path
   * is a client island -- see this file's own note. Absent, the text renders as itself, which is
   * what every comment did before this and what a comment added but not yet re-fetched shows.
   */
  body?: React.ReactNode;
  /** Whether *this* reader may edit or delete *this* comment -- core-api decides again on the call. */
  canModify: boolean;
  reviewClosed: boolean;
}) {
  const t = useTranslations("Review");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    const result = await deleteReviewComment(solutionId, comment.id);
    setDeleting(false);
    setConfirming(false);
    if (result.success) {
      toast.success(t("toast.commentDeleted"));
      router.refresh();
    } else {
      toast.error(t("errors.deleteFailed"), result.formError);
    }
  }

  if (editing) {
    return (
      <div className="border-l-2 border-primary bg-card">
        <ReviewCommentForm
          submitLabel={t("comment.save")}
          reviewClosed={reviewClosed}
          defaultValues={{ text: comment.text, issue: comment.issue }}
          onCancel={() => setEditing(false)}
          onSubmitValues={(values) => updateReviewComment(solutionId, comment.id, values)}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <article className="border-l-2 border-border bg-card p-3 text-sm">
      <header className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-medium">{comment.authorName || t("comment.unknownAuthor")}</span>
        <time
          dateTime={new Date(comment.createdAt * 1000).toISOString()}
          className="text-xs text-muted-foreground"
        >
          {format.dateTime(new Date(comment.createdAt * 1000), DATE_TIME_FORMAT)}
        </time>
        {comment.issue && <Badge tone="warning">{t("comment.issueBadge")}</Badge>}
      </header>
      {body ?? <p className="whitespace-pre-wrap">{comment.text}</p>}
      {canModify && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("comment.edit")}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-md border border-input px-2 py-1 text-xs text-destructive hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("comment.delete")}
          </button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={t("comment.deleteTitle")}
            description={t("comment.deleteDescription")}
            confirmLabel={t("comment.delete")}
            pending={deleting}
            onConfirm={remove}
          />
        </div>
      )}
    </article>
  );
}
