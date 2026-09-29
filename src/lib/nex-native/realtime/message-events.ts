// src/lib/nex-native/realtime/message-events.ts
//
// Bridge 73 · Message events channel (read acks + future delivered
// acks + future reactions). Separate from signalling so calls don't
// deliver a hydrated stream of every read-receipt on the wire.
//
// Channel name: `nex:messages:{conversationId}`.
//
// v1 event: `read-up-to` — the reader announces the timestamp at or
// before which they've read every inbound message. Sender's client
// consumes this to flip its outgoing ticks live without a reload.
//
// Future events (same channel): `delivered`, `reaction`.

"use client";

import { openNexChannel, type NexChannelHandle } from "./channel";

const EVENT_READ_UP_TO = "read-up-to";

export interface ReadUpToBroadcast {
  readerAccountId: string;
  /** ISO 8601 · every inbound message with sent_at ≤ this has been
   *  marked read by the reader. Sender applies this window to their
   *  own outgoing messages. */
  readUpToIso: string;
}

export interface MessageEventsChannel {
  broadcastReadUpTo(readUpToIso: string): Promise<void>;
  close(): Promise<void>;
}

export function openMessageEventsChannel(opts: {
  conversationId: string;
  selfAccountId: string;
  onPeerReadUpTo?: (b: ReadUpToBroadcast) => void;
}): MessageEventsChannel {
  const handle: NexChannelHandle = openNexChannel({
    name: `nex:messages:${opts.conversationId}`,
    selfId: opts.selfAccountId,
    onBroadcast: (event, envelope) => {
      if (event !== EVENT_READ_UP_TO) return;
      const p = envelope.payload as Partial<ReadUpToBroadcast>;
      if (!p.readerAccountId || !p.readUpToIso) return;
      opts.onPeerReadUpTo?.({
        readerAccountId: p.readerAccountId,
        readUpToIso: p.readUpToIso,
      });
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
