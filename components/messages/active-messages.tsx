"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { markSystemMessagesRead } from "@/lib/actions/system-messages";
import type { MessageType } from "@/lib/api/message-types";

import { useRouter } from "@/i18n/navigation";

/**
 * The broadcasts a reader is actually meant to see (AD-007), across the top of every page.
 *
 * **The legacy app hides these behind a bell in the header; here they are on the page.** That is
 * the one deliberate difference (DEC-115): a system message is the instance telling everybody that
 * evaluation is down or that a deadline moved, and a notice worth writing is worth reading without
 * opening a dropdown first. This app's shell has no header bar to hang a bell on either.
 *
 * **"Read" is one timestamp, not a per-message flag**, because that is all core-api stores: the
 * legacy app keeps `systemMessagesAccepted` in the reader's `uiData` and treats everything older
 * as seen. So dismissing marks everything currently on screen, and a message published afterwards
 * comes back on its own -- which is the behaviour somebody would want anyway.
 *
 * The text is deliberately **not** markdown-rendered here, unlike the legacy dropdown: this
 * component sits above every page in the app, and a broadcast is one or two sentences. Rendering
 * arbitrary authored markdown into the frame of every screen is a bigger surface than the feature
 * needs.
 */
const TONES: Record<MessageType, string> = {
  success: "border-success/40 bg-success/10 text-foreground",
  info: "border-accent bg-accent/40 text-foreground",
  warning: "border-warning/40 bg-warning/10 text-foreground",
  danger: "border-destructive/40 bg-destructive/10 text-foreground",
};

export interface ActiveMessage {
  id: string;
  text: string;
  type: MessageType;
  visibleFrom: number;
}

export function ActiveMessages({
  messages,
  userId,
}: {
  messages: ActiveMessage[];
  userId: string;
}) {
  const t = useTranslations("SystemMessages.active");
  const tType = useTranslations("SystemMessages.types");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (messages.length === 0) return null;

  async function dismiss() {
    setPending(true);
    const newest = messages.reduce((latest, one) => Math.max(latest, one.visibleFrom), 0);
    const result = await markSystemMessagesRead(userId, newest || Math.floor(Date.now() / 1000));
    setPending(false);
    if (!result.success) return;
    router.refresh();
  }

  return (
    <aside aria-label={t("label")} className="flex flex-col gap-2 px-4 pt-4 sm:px-6 lg:px-8">
      {messages.map((message) => (
        <p
          key={message.id}
          className={`rounded-lg border px-4 py-3 text-sm ${TONES[message.type]}`}
        >
          <span className="mr-2 font-semibold">{tType(message.type)}</span>
          {message.text}
        </p>
      ))}
      <div>
        <button
          type="button"
          disabled={pending}
          onClick={() => void dismiss()}
          className="rounded-md border border-input px-3 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          {t("dismiss", { count: messages.length })}
        </button>
      </div>
    </aside>
  );
}
