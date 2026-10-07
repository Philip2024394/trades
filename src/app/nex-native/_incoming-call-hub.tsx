"use client";

// src/app/nex-native/_incoming-call-hub.tsx
//
// Bridge 86 · Global incoming-call ring · mounted from layout.tsx so
// it's active on every nex-native page.
// ------------------------------------------------------------------
// Subscribes this account's `nex:calls:in:{account_id}` inbox on
// mount. When a peer rings, shows a fixed-position "incoming call"
// overlay with Accept + Decline · Accept deep-links to the peer chat
// page with ?accept_call=<callId> so PeerCall auto-accepts on mount.
//
// Deliberately does NOT own the RTCPeerConnection · media negotiation
// still runs inside the per-conversation PeerCall on the peer chat
// page. This hub is purely the "notification + deep-link" layer that
// makes calls discoverable no matter where the user is in nex-native.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  openIncomingCallInbox,
  type IncomingCallInbox,
  type IncomingCallRing,
} from "@/lib/nex-native/realtime/incoming-calls";
import { createRingtone, type Ringtone } from "@/lib/nex-native/calls/ringtone";
// B.6A · Vault call-privacy presentation. The sealed universal call
// transport is NOT modified · only the display label gates on vault
// state so a locked Vault never reveals that the incoming caller is
// a vaulted peer.
import { useVaultSession } from "@/lib/nex-native/vault/client/vault-session";
import { listVaultedFriendIdsForViewerAction } from "./vault/_actions";

const RING_TIMEOUT_MS = 45_000;

export interface IncomingCallHubProps {
  selfAccountId: string;
  selfDisplayName: string;
  /** Skip subscription entirely · used when the session hasn't
   *  resolved (unauthenticated pages) so we don't open a channel
   *  we can never authenticate. */
  disabled?: boolean;
}

const NEX = {
  bg: "rgba(2,9,20,0.94)",
  panel: "#050f1e",
  accent: "#00AFFF",
  green: "#16D66B",
  red: "#FF3355",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
};

export function IncomingCallHub(props: IncomingCallHubProps): React.JSX.Element | null {
  const router = useRouter();
  const [active, setActive] = React.useState<IncomingCallRing | null>(null);
  const inboxRef = React.useRef<IncomingCallInbox | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringtoneRef = React.useRef<Ringtone | null>(null);

  React.useEffect(() => {
    if (props.disabled) return;
    const inbox = openIncomingCallInbox({
      selfAccountId: props.selfAccountId,
      onRing: (ring) => {
        // Ignore stale rings that are older than the ring timeout ·
        // this catches broadcast redelivery on reconnect.
        if (Date.now() - ring.at > RING_TIMEOUT_MS) return;
        // Ignore rings for a call we're already showing.
        setActive((cur) => cur?.callId === ring.callId ? cur : ring);
      },
      onCancel: (c) => {
        setActive((cur) => (cur?.callId === c.callId ? null : cur));
      },
    });
    inboxRef.current = inbox;
    return () => {
      inboxRef.current = null;
      void inbox.close();
    };
  }, [props.disabled, props.selfAccountId]);

  // Auto-dismiss the overlay if unanswered.
  React.useEffect(() => {
    if (!active) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActive((cur) => (cur?.callId === active.callId ? null : cur));
    }, RING_TIMEOUT_MS - (Date.now() - active.at));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active]);

  // Bridge 89a · play/stop the synthesized ringtone alongside the
  // visual overlay. Handle survives across ring cycles so multiple
  // consecutive calls don't leak AudioContexts.
  React.useEffect(() => {
    if (!ringtoneRef.current) ringtoneRef.current = createRingtone();
    if (active) {
      ringtoneRef.current.start();
    } else {
      ringtoneRef.current.stop();
    }
  }, [active]);
  React.useEffect(() => {
    return () => { ringtoneRef.current?.stop(); };
  }, []);

  // B.6A · load Alice's vaulted friend / conversation peer IDs so we
  // can hide the caller identity when (a) Vault is locked AND (b) the
  // caller is a vaulted peer. Fetched once on mount via the sealed
  // server action · the list is non-secret (it's Alice's own vault
  // state) and we never derive a secret from it.
  const [vaultedPeerIds, setVaultedPeerIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  React.useEffect(() => {
    if (props.disabled) return;
    let cancelled = false;
    void listVaultedFriendIdsForViewerAction().then((r) => {
      if (cancelled) return;
      if (r.ok) setVaultedPeerIds(new Set(r.friendIds));
    });
    return () => {
      cancelled = true;
    };
  }, [props.disabled]);

  const vaultSession = useVaultSession();
  // When Vault is locked AND the caller is a vaulted peer, replace the
  // peer identity with a generic label everywhere it appears in the
  // call UI. Call transport is untouched · this is purely display.
  const callerIsVaulted =
    active !== null && vaultedPeerIds.has(active.callerAccountId);
  const hidePeerIdentity = callerIsVaulted && !vaultSession.unlocked;
  const displayedCallerName = hidePeerIdentity
    ? "NEX call"
    : active?.callerDisplayName ?? "";

  if (props.disabled) return null;
  if (!active) return null;

  const accept = () => {
    // Deep-link to the peer chat with the accept marker · PeerCall
    // reads this on mount + auto-accepts the incoming call.
    const qs = new URLSearchParams({
      accept_call: active.callId,
      call_media: active.media,
    });
    router.push(
      `/nex-native/chat/peer/${active.callerAccountId}?${qs.toString()}`,
    );
    setActive(null);
  };

  const decline = () => {
    setActive(null);
    // Best-effort: signal on the per-conversation channel that we
    // declined so the caller stops ringing. We don't have a
    // PeerCall instance here, so post directly on the signalling
    // channel via a scratch openSignallingChannel.
    void (async () => {
      try {
        const { openSignallingChannel } = await import(
          "@/lib/nex-native/realtime/signalling"
        );
        const ch = openSignallingChannel({
          conversationId: active.conversationId,
          selfAccountId: props.selfAccountId,
          handlers: {},
        });
        await ch.sendBye({ callId: active.callId, reason: "declined" });
        await ch.close();
      } catch { /* ignore · caller will time out on its own */ }
    })();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Incoming ${active.media} call from ${displayedCallerName}`}
      data-nex-call-hub-privacy-hidden={hidePeerIdentity ? "true" : "false"}
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0) + 16px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(360px, calc(100vw - 24px))",
        zIndex: 2000,
        borderRadius: 20,
        background: NEX.panel,
        border: `1px solid ${NEX.accent}55`,
        boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 0 30px ${NEX.accent}22`,
        color: NEX.text,
        padding: "16px 18px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        gap: 14,
        alignItems: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${NEX.accent}33 0%, ${NEX.accent}12 100%)`,
          border: `1.5px solid ${NEX.accent}55`,
          display: "grid",
          placeItems: "center",
          fontSize: 22,
          flexShrink: 0,
          animation: "nex-ring-pulse 1.4s ease-in-out infinite",
        }}
      >
        {active.media === "video" ? "🎥" : "📞"}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: NEX.accent,
            fontWeight: 700,
            marginBottom: 2,
          }}
        >
          Incoming {active.media === "video" ? "video" : "voice"} call
        </div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          {displayedCallerName}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <RoundButton kind="danger" onClick={decline} label="Decline">
          <XIcon />
        </RoundButton>
        <RoundButton kind="accept" onClick={accept} label="Accept">
          {active.media === "video" ? <VideoIcon /> : <PhoneIcon />}
        </RoundButton>
      </div>
      <style>{`
        @keyframes nex-ring-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 ${NEX.accent}22; }
          50%      { transform: scale(1.08); box-shadow: 0 0 0 10px ${NEX.accent}00; }
        }
      `}</style>
    </div>
  );
}

function RoundButton({
  kind, onClick, label, children,
}: {
  kind: "accept" | "danger";
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const bg = kind === "accept" ? NEX.green : NEX.red;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: bg,
        color: kind === "accept" ? "#02120A" : "#160204",
        border: "none",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        boxShadow: `0 8px 20px ${bg}55`,
      }}
    >
      {children}
    </button>
  );
}

function PhoneIcon(): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.35 1.84.6 2.8.72a2 2 0 0 1 1.72 2z" />
    </svg>
  );
}
function VideoIcon(): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x={1} y={5} width={15} height={14} rx={2} ry={2} />
    </svg>
  );
}
function XIcon(): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={2.4}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1={6} y1={6} x2={18} y2={18} />
      <line x1={18} y1={6} x2={6} y2={18} />
    </svg>
  );
}
