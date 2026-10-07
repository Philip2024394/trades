// src/lib/nex-native/realtime/message-events.ts
//
// Bridge 73 · Message events channel.
// Channel name: `nex:messages:{conversationId}`.
//
// Events on this channel:
//   · `read-up-to` — sealed Bridge 73 · reader announces timestamp at
//     or before which they've read every inbound message · sender's
//     client flips outgoing ticks live.
//   · `arrival`    — R1 · universal live-messaging nudge · a new
//     logical message exists in the conversation · receiver fetches
//     the actual encrypted row via the authenticated /peer-message/
//     since endpoint and decrypts locally. Payload carries ONLY
//     { conversation_id, message_group_id, sent_at } · no body, no
//     ciphertext, no identities.
//
// R1 doctrine
//   · One transport. Normal chat and Vault chat BOTH consume this
//     channel via this module. No Vault-only realtime module exists.
//   · Payload is a nudge. The authenticated fetch is the source of
//     truth. Receivers never trust fields from the broadcast.
//   · Reconciliation runs on mount + visibilitychange + subscribe
//     reconnect · never on a setInterval.

"use client";

import { openNexChannel, type NexChannelHandle } from "./channel";

const EVENT_READ_UP_TO = "read-up-to";
const EVENT_ARRIVAL = "arrival";

export interface ReadUpToBroadcast {
  readerAccountId: string;
  /** ISO 8601 · every inbound message with sent_at ≤ this has been
   *  marked read by the reader. Sender applies this window to their
   *  own outgoing messages. */
  readUpToIso: string;
}

/** R1 · strict arrival payload. Mirrors the server-side type exactly ·
 *  deterministic tests grep-static against both to prevent drift. */
export interface MessageArrivalBroadcast {
  conversation_id: string;
  message_group_id: string;
  sent_at: string;
}

export interface MessageEventsChannel {
  broadcastReadUpTo(readUpToIso: string): Promise<void>;
  close(): Promise<void>;
}

export function openMessageEventsChannel(opts: {
  conversationId: string;
  selfAccountId: string;
  onPeerReadUpTo?: (b: ReadUpToBroadcast) => void;
  /** R1 · fires when a new logical message arrives on this
   *  conversation. Receiver should call /peer-message/since + decrypt
   *  locally. Never trust fields other than conversation_id for
   *  anything beyond dedup. */
  onPeerMessageArrival?: (b: MessageArrivalBroadcast) => void;
  /** R1 · fires once each time the realtime subscription becomes
   *  SUBSCRIBED (initial + reconnect). Consumers use this as a trigger
   *  to run their catch-up fetch. */
  onSubscribed?: () => void;
}): MessageEventsChannel {
  const handle: NexChannelHandle = openNexChannel({
    name: `nex:messages:${opts.conversationId}`,
    selfId: opts.selfAccountId,
    onSubscribed: opts.onSubscribed,
    onBroadcast: (event, envelope) => {
      if (event === EVENT_READ_UP_TO) {
        const p = envelope.payload as Partial<ReadUpToBroadcast>;
        if (!p.readerAccountId || !p.readUpToIso) return;
        opts.onPeerReadUpTo?.({
          readerAccountId: p.readerAccountId,
          readUpToIso: p.readUpToIso,
        });
        return;
      }
      if (event === EVENT_ARRIVAL) {
        const p = envelope.payload as Partial<MessageArrivalBroadcast>;
        if (
          !p.conversation_id ||
          !p.message_group_id ||
          !p.sent_at ||
          p.conversation_id !== opts.conversationId
        ) {
          return;
        }
        opts.onPeerMessageArrival?.({
          conversation_id: p.conversation_id,
          message_group_id: p.message_group_id,
          sent_at: p.sent_at,
        });
        return;
      }
      // Unknown event · ignore. Forward-compat for additional Bridge
      // 73 events on the same channel (e.g. future `delivered`).
    },
  });

  return {
    async broadcastReadUpTo(readUpToIso: string): Promise<void> {
      const body: ReadUpToBroadcast = {
        readerAccountId: opts.selfAccountId,
        readUpToIso,
      };
      await handle.broadcast(
        EVENT_READ_UP_TO,
        body as unknown as Record<string, unknown>,
      );
    },
    close: () => handle.close(),
  };
}

/** Exported ONLY so the R1 deterministic test suite can grep-static the
 *  event name. Code paths above use the local constant. */
export const R1_ARRIVAL_EVENT_NAME = EVENT_ARRIVAL;
