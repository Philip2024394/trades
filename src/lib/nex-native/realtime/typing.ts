// src/lib/nex-native/realtime/typing.ts
//
// Bridge 67 · Typed typing-indicator channel.
//
// One broadcast per keystroke would swamp the WebSocket. Consumers
// should debounce composer input to ~500ms and only fire a ping when
// the buffer has non-whitespace. The receiver auto-expires the
// indicator after 3s of silence — so if the sender stops typing
// without sending, the "is typing…" pill fades on its own.
//
// Channel name: `nex:typing:{conversationId}`.

"use client";

import { openNexChannel, type NexChannelHandle } from "./channel";

const EVENT_NAME = "typing";
export const TYPING_EXPIRY_MS = 3_000;

export interface TypingPing {
  accountId: string;
  displayName: string;
  at: number;
}

export interface TypingChannel {
  /** Announce that the local user is typing right now. Call at most
   *  every ~500ms — the SDK will still forward every ping but the wire
   *  cost is unnecessary for high-frequency keystrokes. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function openTypingChannel(opts: {
  conversationId: string;
  selfAccountId: string;
  selfDisplayName: string;
  onPeerTyping: (ping: TypingPing) => void;
}): TypingChannel {
  const handle: NexChannelHandle = openNexChannel({
    name: `nex:typing:${opts.conversationId}`,
    selfId: opts.selfAccountId,
    onBroadcast: (event, envelope) => {
      if (event !== EVENT_NAME) return;
      const p = envelope.payload as Partial<TypingPing>;
      if (!p.accountId || !p.displayName || typeof p.at !== "number") return;
      opts.onPeerTyping({ accountId: p.accountId, displayName: p.displayName, at: p.at });
    },
  });

  return {
    async ping(): Promise<void> {
      const ping: TypingPing = {
        accountId: opts.selfAccountId,
        displayName: opts.selfDisplayName,
        at: Date.now(),
      };
      await handle.broadcast(EVENT_NAME, ping as unknown as Record<string, unknown>);
    },
    close: () => handle.close(),
  };
}
