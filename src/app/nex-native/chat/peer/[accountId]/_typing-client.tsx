"use client";

// src/app/nex-native/chat/peer/[accountId]/_typing-client.tsx
//
// Bridge 70 · Typing indicator for the peer chat page.
// -----------------------------------------------------
// Two responsibilities:
//   · Broadcast a typing ping when the local user types in the
//     composer (debounced ~500ms).
//   · Render a "{peer} is typing…" pill above the composer when the
//     peer's ping arrives, auto-clearing after 3s of silence.
//
// Attachment strategy: rather than prop-drill an onLocalActivity
// callback through PortraitBloomShell → PeerComposer (which are used
// by non-peer surfaces too), the composer's textarea is marked with
// `data-nex-composer-textarea` and this sibling component finds it
// via querySelector. Attempts up to five times to survive React's
// hydration ordering, then attaches a plain input listener.

import * as React from "react";
import {
  openTypingChannel,
  TYPING_EXPIRY_MS,
  type TypingChannel,
} from "@/lib/nex-native/realtime/typing";

const PING_DEBOUNCE_MS = 500;
const ATTACH_MAX_ATTEMPTS = 5;
const ATTACH_INTERVAL_MS = 200;

export interface PeerTypingClientProps {
  conversationId: string;
  selfAccountId: string;
  selfDisplayName: string;
  peerDisplayName: string;
  /** Skip entirely for NEX1 · typing echo from ops is not a signal
   *  the buyer needs. */
  disabled?: boolean;
}

export function PeerTypingClient(props: PeerTypingClientProps): React.JSX.Element | null {
  const [peerTypingAt, setPeerTypingAt] = React.useState<number | null>(null);
  const channelRef = React.useRef<TypingChannel | null>(null);
  const lastPingSentRef = React.useRef<number>(0);

  // Open the typing channel + subscribe.
  React.useEffect(() => {
    if (props.disabled) return;
    const channel = openTypingChannel({
      conversationId: props.conversationId,
      selfAccountId: props.selfAccountId,
      selfDisplayName: props.selfDisplayName,
      onPeerTyping: (ping) => setPeerTypingAt(ping.at),
    });
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void channel.close();
    };
  }, [
    props.conversationId,
    props.selfAccountId,
    props.selfDisplayName,
    props.disabled,
  ]);

  // Attach a local input listener to the composer textarea. The
  // composer lives inside PortraitBloomShell and hydrates after us,
  // so we retry until it appears (usually first attempt succeeds).
  React.useEffect(() => {
    if (props.disabled) return;
    let attempt = 0;
    let attached: HTMLTextAreaElement | null = null;

    const onInput = () => {
      const now = Date.now();
      if (now - lastPingSentRef.current < PING_DEBOUNCE_MS) return;
      lastPingSentRef.current = now;
      void channelRef.current?.ping();
    };

    const tryAttach = () => {
      const el = document.querySelector<HTMLTextAreaElement>(
        "[data-nex-composer-textarea]",
      );
      if (el) {
        attached = el;
        el.addEventListener("input", onInput);
        return;
      }
      attempt += 1;
      if (attempt < ATTACH_MAX_ATTEMPTS) {
        setTimeout(tryAttach, ATTACH_INTERVAL_MS);
      }
    };
    tryAttach();

    return () => {
      if (attached) attached.removeEventListener("input", onInput);
    };
  }, [props.disabled]);

  // Auto-clear the peer typing pill after TYPING_EXPIRY_MS of silence.
  React.useEffect(() => {
    if (peerTypingAt === null) return;
    const t = setTimeout(() => setPeerTypingAt(null), TYPING_EXPIRY_MS);
    return () => clearTimeout(t);
  }, [peerTypingAt]);

  if (props.disabled) return null;
  if (peerTypingAt === null) return null;

  return <TypingPill peerDisplayName={props.peerDisplayName} />;
}

function TypingPill({ peerDisplayName }: { peerDisplayName: string }): React.JSX.Element {
  // Positioned just above where the composer sits (~110px from bottom
  // to clear the composer pill + safe-area). Fixed so it doesn't move
  // when the chat scrolls, matches the call-launcher's overlay layer.
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "calc(env(safe-area-inset-bottom, 0) + 110px)",
        zIndex: 5,
        padding: "6px 12px 6px 10px",
        borderRadius: 999,
        background: "rgba(4,20,36,0.85)",
        border: "1px solid rgba(0,159,239,0.35)",
        color: "#DDE9FA",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.01em",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        boxShadow: "0 8px 20px rgba(0,0,0,0.45)",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
        backdropFilter: "blur(8px)",
      }}
    >
      <TypingDots />
      <span>{peerDisplayName} is typing…</span>
    </div>
  );
}

function TypingDots(): React.JSX.Element {
  // Three-dot bounce via inline keyframes injected once. Small enough
  // that the paint cost is trivial and avoids pulling a global CSS
  // rule for a single visual element.
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        gap: 3,
        alignItems: "center",
      }}
    >
      <style>{`
        @keyframes nex-typing-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.55; }
          40%           { transform: scale(1);   opacity: 1; }
        }
      `}</style>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#00AFFF",
            display: "inline-block",
            animation: "nex-typing-bounce 1.2s infinite ease-in-out",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </span>
  );
}
