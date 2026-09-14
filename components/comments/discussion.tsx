import { getTranslations } from "next-intl/server";

import { getCommentThread } from "@/lib/api/comments";
import { getCurrentUser } from "@/lib/api/current-user";

import { CommentThread, type DiscussionSubject } from "./comment-thread";

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
  subject,
  canModerate = false,
  title,
  teacherIds,
}: {
  threadId: string;
  subject: DiscussionSubject;
  canModerate?: boolean;
  title?: string;
  /** Group staff, so a teacher's voice is marked. Omit where the thread has no group. */
  teacherIds?: string[];
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
        <p className="text-sm text-muted-foreground">{t(`explain.${subject}`)}</p>
      </div>
      <CommentThread
        threadId={thread.id}
        comments={thread.comments}
        currentUserId={user.id}
        canModerate={canModerate}
        subject={subject}
        teacherIds={teacherIds}
      />
    </section>
  );
}
