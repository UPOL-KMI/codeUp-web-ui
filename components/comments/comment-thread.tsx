"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { addComment, deleteComment, setCommentPrivacy } from "@/lib/actions/comments";
import type { Comment } from "@/lib/api/comments";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { Badge } from "@/components/status/badge";
import { useToast } from "@/components/toast/toast-provider";

/**
 * A discussion thread (T-022) -- the legacy `CommentThreadContainer`, on the screens that had one.
 *
 * **"Private" here means a note to oneself, not a note to the staff.** core-api filters a private
 * comment out of everybody else's copy of the thread entirely, so it is nearer a margin note than
 * a restricted message -- and the checkbox says so rather than leaving somebody to find out by
 * being surprised. Who "public" reaches differs by screen (a group's supervisors, the solution's
 * author, whoever can see a reference solution), so each mount point supplies that sentence.
 *
 * **Deleting and unhiding are offered where this app has a basis**, not everywhere core-api would
 * allow them: the reader's own comments always, and everybody's where the page already knows the
 * reader teaches there. core-api's rule is `isAuthor` *or* supervising the group of the commented
 * solution or assignment, and no hint for it rides on a comment -- so the offer is an
 * approximation on the safe side and core-api decides for real (DEC-090's shape once more).
 */
export function CommentThread({
  threadId,
  comments,
  currentUserId,
  canModerate = false,
  publicMeans,
}: {
  threadId: string;
  comments: Comment[];
  currentUserId: string;
  canModerate?: boolean;
  /** Who a public comment reaches here, in this screen's own words. */
  publicMeans: string;
}) {
  const t = useTranslations("Comments");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();

  const [text, setText] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Comment | null>(null);

  async function run(call: () => Promise<ActionResult<unknown>>, successKey?: string) {
    // The buttons are `aria-disabled` rather than `disabled` -- disabling the element under the
    // pointer or the caret drops focus to the body -- so refusing the second call is this guard's.
    if (pending) return false;
    setPending(true);
    setError(null);
    const result = await call();
    setPending(false);
    if (!result.success) {
      setError(result.formError ?? t("errors.postFailed"));
      return false;
    }
    if (successKey) toast.success(t(successKey));
    router.refresh();
    return true;
  }

  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => {
            const mine = comment.authorId === currentUserId;
            return (
              <li
                key={comment.id}
                className={`rounded-lg border p-3 text-sm ${
                  comment.isPrivate ? "border-dashed border-border bg-muted/30" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">
                    {comment.authorName || t("unknownAuthor")}
                    {mine && <span className="ml-1 text-xs text-muted-foreground">{t("you")}</span>}
                  </span>
                  <time
                    dateTime={new Date(comment.postedAt * 1000).toISOString()}
                    className="text-xs text-muted-foreground"
                  >
                    {format.dateTime(new Date(comment.postedAt * 1000), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                  {comment.isPrivate && <Badge tone="neutral">{t("privateBadge")}</Badge>}
                </div>

                <p className="mt-1 whitespace-pre-wrap">{comment.text}</p>

                {(mine || canModerate) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-disabled={pending}
                      onClick={() =>
                        void run(
                          () => setCommentPrivacy(threadId, comment.id, !comment.isPrivate),
                          comment.isPrivate ? "madePublic" : "madePrivate",
                        )
                      }
                      className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted aria-disabled:opacity-60"
                    >
                      {comment.isPrivate ? t("makePublic") : t("makePrivate")}
                    </button>
                    <button
                      type="button"
                      aria-disabled={pending}
                      onClick={() => {
                        if (pending) return;
                        setDeleting(comment);
                      }}
                      className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted aria-disabled:opacity-60"
                    >
                      {t("delete")}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          {t("write")}
          <textarea
            rows={3}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={isPrivate}
            onChange={(event) => setIsPrivate(event.target.checked)}
          />
          <span>
            {t("keepPrivate")}
            <span className="block text-xs text-muted-foreground">
              {isPrivate ? t("privateMeans") : t("publicMeans", { audience: publicMeans })}
            </span>
          </span>
        </label>

        <div>
          <button
            type="button"
            aria-disabled={pending || text.trim() === ""}
            onClick={() => {
              if (pending || text.trim() === "") return;
              void run(() => addComment(threadId, text, isPrivate), "posted").then((ok) => {
                if (ok) setText("");
              });
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground aria-disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {pending ? t("posting") : t("post")}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("confirmDelete.title")}
        description={t("confirmDelete.description")}
        confirmLabel={t("confirmDelete.action")}
        pending={pending}
        onConfirm={() => {
          const comment = deleting;
          setDeleting(null);
          if (comment) void run(() => deleteComment(threadId, comment.id), "deleted");
        }}
      />
    </div>
  );
}
