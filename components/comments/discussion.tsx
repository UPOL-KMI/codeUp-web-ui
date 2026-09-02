import { getTranslations } from "next-intl/server";

import { getCommentThread } from "@/lib/api/comments";
import { getCurrentUser } from "@/lib/api/current-user";

import { CommentThread } from "./comment-thread";

/**
 * The discussion section as a screen mounts it (T-022): a Server Component that reads the thread
 * and hands it to the client one.
 *
 * The thread is read here rather than by the client component because it is part of the page --
 * a discussion that appeared a beat after everything else, or only for readers with JavaScript,
 * would be a worse version of what the legacy app already does.
 */
export async function Discussion({
  threadId,
  publicMeans,
  canModerate = false,
  title,
}: {
  threadId: string;
  /** Who a public comment reaches on this screen, in its own words. */
  publicMeans: string;
  canModerate?: boolean;
  title?: string;
}) {
  const [t, thread, user] = await Promise.all([
    getTranslations("Comments"),
    getCommentThread(threadId),
    getCurrentUser(),
  ]);

  // core-api refuses the thread to a reader who may not see it; the rest of the page stands.
  if (!thread) return null;

  return (
    <section aria-labelledby={`discussion-${threadId}`} className="flex flex-col gap-3">
      <div>
        <h2 id={`discussion-${threadId}`} className="text-base font-semibold tracking-tight">
          {title ?? t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("explain")}</p>
      </div>
      <CommentThread
        threadId={thread.id}
        comments={thread.comments}
        currentUserId={user.id}
        canModerate={canModerate}
        publicMeans={publicMeans}
      />
    </section>
  );
}
