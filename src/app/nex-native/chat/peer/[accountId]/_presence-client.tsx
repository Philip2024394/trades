"use client";

// src/app/nex-native/chat/peer/[accountId]/_presence-client.tsx
//
// Bridge 71 · Live presence for the peer chat page.
// --------------------------------------------------
// Two responsibilities:
//   · Publish the local user as "online" on the global presence roster
//     for the duration of this mount. Supabase Realtime emits "leave"
//     automatically when the socket drops, so offline detection is free.
//   · Subscribe to the roster and render a small live status pill
//     when the peer is currently online.
//
// Also fires window CustomEvents ("nex-peer-presence") for future
// consumers (avatar ring tint, chip ring tint, friends-list green dots)
// to react without re-subscribing to Realtime themselves.
//
// The account-scoped `presence_visible` opt-in gate from the sealed
// 2026-09-27 doctrine is not yet in schema. Until the migration lands,
// every signed-in user on nex-native publishes presence — matching
// WhatsApp/Signal default behavior (peers-only visibility already
// implicit because we broadcast to a global roster keyed by accountId
// and only friends resolve display info).

import * as React from "react";
import {
  openPresenceChannel,
  type PresenceChannel,
  type PresenceKind,
  type PresenceState,
} from "@/lib/nex-native/realtime/presence";

export interface PeerPresenceClientProps {
  selfAccountId: string;
  selfDisplayName: string;
  peerAccountId: string;
  peerDisplayName: string;
  /** Skip entirely for NEX1 · ops presence isn't a signal buyers need. */
  disabled?: boolean;
}

const PRESENCE_EVENT = "nex-peer-presence";

export function PeerPresenceClient(props: PeerPresenceClientProps): React.JSX.Element | null {
  const [peerKind, setPeerKind] = React.useState<PresenceKind | null>(null);
  const channelRef = React.useRef<PresenceChannel | null>(null);

  React.useEffect(() => {
    if (props.disabled) return;

    const channel = openPresenceChannel({
      selfAccountId: props.selfAccountId,
      selfDisplayName: props.selfDisplayName,
      initialKind: "online",
      onRosterChange: (roster) => {
        // Find the peer in the roster; missing = offline.
        const peer = roster.find((r) => r.accountId === props.peerAccountId);
        const next: PresenceKind = peer ? peer.kind : "offline";
        setPeerKind(next);
        // Broadcast a window event so other components can update
        // their rings / dots without opening their own Realtime channel.
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(PRESENCE_EVENT, {
              detail: {
                accountId: props.peerAccountId,
                kind: next,
                roster: roster.filter((r): r is PresenceState => !!r),
              },
            }),
          );
        }
      },
    });
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      void channel.close();
    };
  }, [
    props.selfAccountId,
    props.selfDisplayName,
    props.peerAccountId,
    props.disabled,
  ]);

  // Also flip self's state to "busy" when a call is active on this page.
  // Listens to the same custom event stream the launcher could emit in a
  // follow-up · for now, `online` is the only state we publish so the
  // component stays inert until we wire call-state signals through.

  if (props.disabled) return null;
  // Only render when the peer is confirmed online — an additive chip
  // that layers on top of the shell's static "online/offline" pill.
  // When the peer is offline or unknown, we render nothing and defer
  // to the shell's default rendering.
  if (peerKind !== "online" && peerKind !== "busy") return null;

  return <PresencePill kind={peerKind} peerName={props.peerDisplayName} />;
}

function PresencePill({
  kind,
  peerName,
}: {
  kind: PresenceKind;
  peerName: string;
}): React.JSX.Element {
  const color = kind === "busy" ? "#F59E0B" : "#16D66B";
  const bg = kind === "busy"
    ? "rgba(245,158,11,0.14)"
    : "rgba(22,214,107,0.14)";
  const border = kind === "busy"
    ? "rgba(245,158,11,0.42)"
    : "rgba(22,214,107,0.42)";
  const label = kind === "busy" ? "In a call" : "Online now";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${peerName} is ${label.toLowerCase()}`}
      title={`${peerName} · ${label.toLowerCase()}`}
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0) + 62px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 5,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px 4px 8px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        pointerEvents: "none",
        backdropFilter: "blur(8px)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 0 2px ${bg}`,
          display: "inline-block",
        }}
      />
      {label}
    </div>
  );
}
