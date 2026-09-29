"use client";

// src/app/nex-native/chat/peer/[accountId]/_message-events-client.tsx
//
// Bridge 73 · Live read-receipt propagation for the peer chat page.
// -----------------------------------------------------------------
// On mount:
//   · Broadcasts a `read-up-to` event on the conversation's message
//     events channel with the current wall-clock timestamp. Every
//     inbound message the reader just marked read (server did it on
//     page render) is implicitly ≤ now, so this tells the sender
//     "I've caught up." Sender's client flips ticks live.
// On peer broadcast:
//   · Fires a window CustomEvent (`nex-msg-read-ack`) so each
//     `<ReadTick>` for a message with sent_at ≤ readUpTo transitions
//     to the read state without re-fetching.
//
// v1 broadcasts once on mount only. Future work (live inbound
// messages via realtime) will add another broadcast whenever the
// reader focuses the tab or an unread message becomes visible.

import * as React from "react";
import {
  openMessageEventsChannel,
  type MessageEventsChannel,
} from "@/lib/nex-native/realtime/message-events";
import { dispatchReadAck } from "../../_read-tick";

export interface PeerMessageEventsClientProps {
  conversationId: string;
  selfAccountId: string;
  disabled?: boolean;
}

export function PeerMessageEventsClient(
  props: PeerMessageEventsClientProps,
): React.JSX.Element | null {
  const channelRef = React.useRef<MessageEventsChannel | null>(null);

  React.useEffect(() => {
    if (props.disabled) return;
    const channel = openMessageEventsChannel({
      conversationId: props.conversationId,
      selfAccountId: props.selfAccountId,
      onPeerReadUpTo: (b) => {
        dispatchReadAck({
          conversationId: props.conversationId,
          readerAccountId: b.readerAccountId,
          readUpToMs: new Date(b.readUpToIso).getTime(),
        });
      },
    });
    channelRef.current = channel;

    // Broadcast once on mount so the peer's outgoing ticks flip live.
    void channel.broadcastReadUpTo(new Date().toISOString());

    return () => {
      channelRef.current = null;
      void channel.close();
    };
  }, [props.conversationId, props.selfAccountId, props.disabled]);

  return null;
}
