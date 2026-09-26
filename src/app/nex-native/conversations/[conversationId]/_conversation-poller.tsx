"use client";

// src/app/nex-native/conversations/[conversationId]/_conversation-poller.tsx
//
// Wave 10 · UI-side auto-refresh for the queue-driven reply path.
// -----------------------------------------------------------------
// When the server action enqueues the NEX Assistant reply (rather than
// running it inline), the page render immediately after send shows the
// customer's own message but no reply yet · the worker picks the job
// up seconds later and posts to nex_message.
//
// This client component detects that "awaiting reply" state (last
// message came from the customer, not from NEX Assistant) and calls
// `router.refresh()` on an interval until either:
//   · a newer NEX Assistant message appears, or
//   · the timeout expires
//
// No local state pretends to be persistence · every refresh re-fetches
// the real conversation from Supabase via the RSC page.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ConversationPollerProps {
  /** ISO timestamp of the LAST message in the current render · used as
   *  the effect dependency so a new render (new last message) resets the
   *  polling window. */
  lastMessageAt: string;
  /** True iff the last message in the current render was sent by the
   *  CURRENT viewer. Only then does the client have a reason to poll:
   *  the viewer is awaiting a reply. If the last message came from
   *  anyone else (NEX Assistant, business owner, etc.), the viewer has
   *  nothing to wait for and polling stops. */
  lastMessageIsFromMe: boolean;
  /** Poll interval in milliseconds · defaults to 2000. */
  intervalMs?: number;
  /** Absolute deadline in milliseconds from mount · defaults to 90 000. */
  timeoutMs?: number;
}

export function ConversationPoller({
  lastMessageAt,
  lastMessageIsFromMe,
  intervalMs = 2000,
  timeoutMs = 90_000,
}: ConversationPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "polling" | "stopped" | "timeout">(
    lastMessageIsFromMe ? "polling" : "idle"
  );

  useEffect(() => {
    if (!lastMessageIsFromMe) {
      setStatus("idle");
      return;
    }
    setStatus("polling");
    const start = Date.now();
    const t = setInterval(() => {
      if (Date.now() - start >= timeoutMs) {
        clearInterval(t);
        setStatus("timeout");
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => {
      clearInterval(t);
      setStatus("stopped");
    };
  }, [lastMessageAt, lastMessageIsFromMe, intervalMs, timeoutMs, router]);

  if (status === "polling") {
    return (
      <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-500" />
        <span>Nex is thinking…</span>
      </div>
    );
  }
  if (status === "timeout") {
    return (
      <div className="mt-1 flex flex-col gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
        <span>Nex is taking longer than usual · try refreshing or send again.</span>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex min-h-[36px] items-center justify-center self-start rounded bg-amber-200 px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-300 sm:self-auto"
        >
          Refresh
        </button>
      </div>
    );
  }
  return null;
}
