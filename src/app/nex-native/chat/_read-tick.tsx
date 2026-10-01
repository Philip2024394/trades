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
  /** Active peer's chat_theme.accent_hex · when read, the dot flips to
   *  this colour so the ONE moment of saturated accent per message
   *  belongs to the theme (Joker · acid green, Night Sky · blue,
   *  Pink Dream · pink). Falls back to NEX cyan when not provided. */
  themeAccent?: string | null;
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

  // Dot-only receipt · sealed 2026-10-01.
  //   · Sent (unread) · hollow muted ring · the message is out but
  //                      hasn't landed in the peer's eyes yet.
  //   · Read          · solid accent dot with soft glow · one moment
  //                      of saturated theme colour per message so the
  //                      bite feels earned, not ambient.
  // No tick glyph · the ring→dot transition reads as "message landed"
  // in a split second without pulling WhatsApp iconography onto a
  // theme-coded surface.
  const accent = props.themeAccent ?? "#00AFFF";
  const label = read ? "Read" : "Sent";
  const dotRgb = hexToRgbTriple(accent);
  const glow = `rgba(${dotRgb},0.6)`;

  return (
    <span
      aria-label={label}
      title={label}
      style={{
        marginLeft: 5,
        display: "inline-flex",
        alignItems: "center",
        verticalAlign: "middle",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: read ? accent : "transparent",
          border: read
            ? "none"
            : "1.5px solid rgba(180,195,220,0.55)",
          boxShadow: read ? `0 0 8px ${glow}, 0 0 2px ${glow}` : "none",
          transition:
            "background 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
        }}
      />
    </span>
  );
}

function hexToRgbTriple(hex: string): string {
  const clean = (hex || "").replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const n = parseInt(full || "00AFFF", 16);
  if (Number.isNaN(n)) return "0,175,255";
  return `${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff}`;
}

/** Emit a read-ack window event · called by _message-events-client
 *  when the peer broadcasts on the realtime channel. Exported here so
 *  the constant name is defined in one place. */
export function dispatchReadAck(detail: NexMsgReadAckDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(READ_ACK_EVENT, { detail }));
}

