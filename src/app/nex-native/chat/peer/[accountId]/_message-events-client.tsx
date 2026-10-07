"use client";

// src/app/nex-native/chat/peer/[accountId]/_message-events-client.tsx
//
// Bridge 73 · Live message events for the peer chat page.
// -------------------------------------------------------
// Subscriptions on the sealed `nex:messages:{conversationId}` channel:
//
//   · `read-up-to` (sealed) · broadcasts once on mount so the peer's
//     outgoing ticks flip live. Peer's broadcast forwards to the
//     local <ReadTick>s via `dispatchReadAck`.
//
//   · `arrival`    (R1)     · universal live-messaging nudge · fires
//     when a new logical message exists in this conversation. We do
//     NOT trust any field in the payload beyond conversation_id. The
//     response is simply `router.refresh()` which re-renders the SSR
//     tree with the new row's data-attributes · the existing Bridge
//     76 MutationObserver decryptor (_e2e-decryptor.tsx) picks it up
//     and swaps `(encrypted)` → plaintext in place. No new decrypt
//     system is introduced.
//
// Reconciliation (R1 · never a setInterval):
//   · on mount                     — close the SSR→subscribe gap
//   · on visibilitychange visible  — a sleeping tab waking up
//   · on realtime (re)subscribe    — WebSocket reconnect
//
// All three paths fire `router.refresh()`. The server-rendered SSR
// is the canonical source of truth · realtime is the optimisation.

import * as React from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const channelRef = React.useRef<MessageEventsChannel | null>(null);
  // Track the most recent arrival so a storm of broadcasts coalesces
  // into one refresh · the ref is intentionally in-tab memory only ·
  // persistent cross-session watermarks are out of R1 scope.
  const lastRefreshAtRef = React.useRef<number>(0);

  // Shared "catch up" handler used by every reconciliation trigger.
  // We throttle to one refresh per 400ms so a burst of events (arrival
  // + visibility + reconnect in close succession) doesn't thrash the
  // Next router. The SSR response is cached briefly by Next anyway so
  // real server load is minimal.
  const refreshThrottled = React.useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < 400) return;
    lastRefreshAtRef.current = now;
    router.refresh();
  }, [router]);

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
      // R1 · nudge → refresh. Payload is intentionally ignored beyond
      // the self-filter and conversation-id-match the shared channel
      // helper already enforces.
      onPeerMessageArrival: () => {
        refreshThrottled();
      },
      // R1 · fires on every SUBSCRIBED transition including reconnect.
      onSubscribed: () => {
        refreshThrottled();
      },
    });
    channelRef.current = channel;

    // Broadcast once on mount so the peer's outgoing ticks flip live
    // (sealed Bridge 73 behaviour).
    void channel.broadcastReadUpTo(new Date().toISOString());

    // R1 · visibility reconciliation. A tab coming back from sleep
    // might have missed broadcasts while the WebSocket was torn down
    // · refresh to catch up. No setInterval anywhere.
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshThrottled();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      channelRef.current = null;
      void channel.close();
    };
  }, [
    props.conversationId,
    props.selfAccountId,
    props.disabled,
    refreshThrottled,
  ]);

  return null;
}
