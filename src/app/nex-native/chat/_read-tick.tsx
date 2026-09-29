"use client";

// src/app/nex-native/chat/_read-tick.tsx
//
// Bridge 73 · Read-status tick marks for outgoing messages.
// ---------------------------------------------------------
// Renders three states:
//   · "sent"      — server has the message; peer hasn't read it yet.
//                   Single grey ✓.
//   · "delivered" — reserved for when nex_peer_message.delivered_at
//                   lands. Currently unused (v1 collapses to "sent").
//   · "read"      — peer has opened the chat past this message's
//                   send timestamp. Double blue ✓✓.
//
// Live update: on mount, listens to window event "nex-msg-read-ack"
// dispatched by _message-events-client. When the peer announces a
// readUpTo timestamp ≥ this message's sentAt, the tick flips to read
// without a page reload. Sender sees the flip instantly.

import * as React from "react";

const READ_ACK_EVENT = "nex-msg-read-ack";

export interface NexMsgReadAckDetail {
  conversationId: string;
  readerAccountId: string;
  readUpToMs: number;
}

interface ReadTickProps {
  /** ISO 8601 send time. */
  sentAtIso: string;
  /** ISO 8601 read time (from server render). Null when never read yet. */
  readAtIso?: string | null;
  /** Message id · used for aria-label only. */
  messageId?: string;
  /** Conversation id · scopes which read-ack events apply. */
  conversationId?: string;
}

export function ReadTick(props: ReadTickProps): React.JSX.Element {
  const sentAtMs = React.useMemo(
    () => new Date(props.sentAtIso).getTime(),
    [props.sentAtIso],
  );
  const initialRead = !!props.readAtIso;
  const [read, setRead] = React.useState(initialRead);

  React.useEffect(() => {
    if (read) return; // nothing to upgrade
    const handler = (evt: Event) => {
      const detail = (evt as CustomEvent<NexMsgReadAckDetail>).detail;
      if (!detail) return;
      if (props.conversationId && detail.conversationId !== props.conversationId) return;
      if (detail.readUpToMs >= sentAtMs) setRead(true);
    };
    window.addEventListener(READ_ACK_EVENT, handler);
    return () => window.removeEventListener(READ_ACK_EVENT, handler);
  }, [props.conversationId, sentAtMs, read]);

  const color = read ? "#7BC8FF" : "rgba(255,255,255,0.65)";
  const label = read ? "Read" : "Sent";

  return (
    <span
      aria-label={label}
      title={label}
      style={{
        marginLeft: 5,
        display: "inline-flex",
        alignItems: "center",
        color,
        transition: "color 220ms ease",
        verticalAlign: "middle",
      }}
    >
      <TickSvg double={read} />
    </span>
  );
}

/** Emit a read-ack window event · called by _message-events-client
 *  when the peer broadcasts on the realtime channel. Exported here so
 *  the constant name is defined in one place. */
export function dispatchReadAck(detail: NexMsgReadAckDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(READ_ACK_EVENT, { detail }));
}

function TickSvg({ double }: { double: boolean }): React.JSX.Element {
  const width = double ? 16 : 10;
  return (
    <svg
      width={width}
      height={10}
      viewBox={`0 0 ${double ? 16 : 10} 10`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 5.5 L3.4 8 L9 2.5" />
      {double && <path d="M7 5.5 L9.4 8 L15 2.5" />}
    </svg>
  );
}
