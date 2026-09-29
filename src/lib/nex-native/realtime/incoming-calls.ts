// src/lib/nex-native/realtime/incoming-calls.ts
//
// Bridge 86 · Per-account inbox for incoming call rings.
// ------------------------------------------------------
// Every signed-in NEX user subscribes to `nex:calls:in:{account_id}`
// at app-shell mount. Callers broadcast a `ring` to the callee's
// inbox in addition to the per-conversation signalling channel so
// the ring lands anywhere the callee has NEX open, not just when
// they happen to be viewing the specific peer chat.
//
// This is the "global ring" layer. Media negotiation still runs on
// the per-conversation signalling channel — the inbox only carries
// the "someone is calling you" hint plus the caller identity + conv
// id so the callee's UI can deep-link into the right peer chat to
// answer.

"use client";

import { openNexChannel, type NexChannelHandle } from "./channel";

export type CallInboxMedia = "audio" | "video";

export interface IncomingCallRing {
  callId: string;
  conversationId: string;
  callerAccountId: string;
  callerDisplayName: string;
  media: CallInboxMedia;
  /** Wall-clock ms when the caller announced the ring · used to
   *  ignore stale broadcasts that arrive after the caller gave up
   *  (e.g. cross-tab redelivery). */
  at: number;
}

export interface IncomingCallCancel {
  callId: string;
  /** So the callee's UI can dismiss the correct ring overlay if it
   *  has multiple in flight (rare but possible with fan-out). */
}

export interface IncomingCallInbox {
  /** Broadcast a ring to a peer's inbox · caller-side helper. */
  ring(peerAccountId: string, payload: Omit<IncomingCallRing, "at">): Promise<void>;
  /** Broadcast a cancel · caller decided to hang up before the callee
   *  answered · lets the callee dismiss the ring overlay. */
  cancel(peerAccountId: string, callId: string): Promise<void>;
  close(): Promise<void>;
}

function channelNameFor(accountId: string): string {
  return `nex:calls:in:${accountId}`;
}

/**
 * Open THIS account's inbox subscription. Fires onRing whenever a
 * peer broadcasts to `nex:calls:in:{self_account_id}`. Also returns
 * caller-side helpers to ring / cancel other accounts' inboxes.
 */
export function openIncomingCallInbox(opts: {
  selfAccountId: string;
  onRing: (ring: IncomingCallRing) => void;
  onCancel?: (cancel: IncomingCallCancel) => void;
}): IncomingCallInbox {
  // Self subscription — receives ring broadcasts addressed to us.
  const selfHandle: NexChannelHandle = openNexChannel({
    name: channelNameFor(opts.selfAccountId),
    selfId: opts.selfAccountId,
    onBroadcast: (event, envelope) => {
      const payload = envelope.payload as Partial<IncomingCallRing & IncomingCallCancel>;
      if (event === "ring") {
        if (
          !payload.callId || !payload.conversationId ||
          !payload.callerAccountId || !payload.callerDisplayName ||
          (payload.media !== "audio" && payload.media !== "video") ||
          typeof payload.at !== "number"
        ) return;
        opts.onRing({
          callId: payload.callId,
          conversationId: payload.conversationId,
          callerAccountId: payload.callerAccountId,
          callerDisplayName: payload.callerDisplayName,
          media: payload.media,
          at: payload.at,
        });
      } else if (event === "cancel") {
        if (!payload.callId) return;
        opts.onCancel?.({ callId: payload.callId });
      }
    },
  });

  return {
    async ring(peerAccountId: string, payload: Omit<IncomingCallRing, "at">): Promise<void> {
      // Caller opens a short-lived channel to the peer's inbox and
      // broadcasts. We could keep this handle open for cancel() but
      // reopening on cancel is fine — cancels are rare relative to
      // rings and the SDK dedupes channel opens under the hood.
      const targetHandle = openNexChannel({
        name: channelNameFor(peerAccountId),
        selfId: opts.selfAccountId,
      });
      try {
        const body: IncomingCallRing = { ...payload, at: Date.now() };
        await targetHandle.broadcast("ring", body as unknown as Record<string, unknown>);
      } finally {
        await targetHandle.close();
      }
    },
    async cancel(peerAccountId: string, callId: string): Promise<void> {
      const targetHandle = openNexChannel({
        name: channelNameFor(peerAccountId),
        selfId: opts.selfAccountId,
      });
      try {
        await targetHandle.broadcast(
          "cancel",
          { callId } as unknown as Record<string, unknown>,
        );
      } finally {
        await targetHandle.close();
      }
    },
    close: () => selfHandle.close(),
  };
}
