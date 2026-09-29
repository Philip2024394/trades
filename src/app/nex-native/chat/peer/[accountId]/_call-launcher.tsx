"use client";

// src/app/nex-native/chat/peer/[accountId]/_call-launcher.tsx
//
// Bridge 68 · Voice-call launcher + overlay for the peer chat page.
// ------------------------------------------------------------------
// Renders a compact "phone" button pinned top-left of the peer chat
// (mirroring the top-right home/cart/shop cluster). Owns:
//   · the PeerCall client (WebRTC + signalling)
//   · call-state UI (dialing / incoming / connected / ended)
//   · the remote-audio <audio> element
//   · full-screen overlay when a call is active
//
// Rendered as a sibling of PortraitBloomShell in the peer chat page.
// The whole thing is self-contained — it doesn't reach into the shell.

import * as React from "react";
import {
  PeerCall,
  type PeerCallEndReason,
  type PeerCallMedia,
  type PeerCallState,
} from "@/lib/nex-native/calls/peer-call";

export interface PeerCallLauncherProps {
  conversationId: string;
  selfAccountId: string;
  selfDisplayName: string;
  peerAccountId: string;
  peerDisplayName: string;
  peerAvatarUrl?: string | null;
  /** Skip rendering entirely (e.g. NEX1 support chat has no call). */
  disabled?: boolean;
}

const NEX = {
  bg: "rgba(2,9,20,0.96)",
  accent: "#00AFFF",
  green: "#16D66B",
  red: "#FF3355",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
};

const CALL_BUTTON_STYLE: React.CSSProperties = {
  width: 36,
  height: 36,
  border: "none",
  background: "transparent",
  color: NEX.accent,
  padding: 6,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))",
  transition: "opacity 160ms ease, transform 120ms ease",
};

export function PeerCallLauncher(props: PeerCallLauncherProps): React.JSX.Element | null {
  const [state, setState] = React.useState<PeerCallState>("idle");
  const [incomingCaller, setIncomingCaller] = React.useState<string>("");
  const [incomingMedia, setIncomingMedia] = React.useState<PeerCallMedia>("audio");
  const [currentMedia, setCurrentMedia] = React.useState<PeerCallMedia>("audio");
  const [remoteStream, setRemoteStream] = React.useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = React.useState<MediaStream | null>(null);
  const [muted, setMuted] = React.useState(false);
  const [cameraOff, setCameraOff] = React.useState(false);
  const [endReason, setEndReason] = React.useState<PeerCallEndReason | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = React.useState(0);

  const callRef = React.useRef<PeerCall | null>(null);
  const remoteAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const localVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const connectedAtRef = React.useRef<number | null>(null);

  // Instantiate PeerCall once per conversation.
  React.useEffect(() => {
    if (props.disabled) return;
    const call = new PeerCall({
      conversationId: props.conversationId,
      selfAccountId: props.selfAccountId,
      selfDisplayName: props.selfDisplayName,
      handlers: {
        onStateChange: (s) => {
          setState(s);
          if (s === "connected") {
            connectedAtRef.current = Date.now();
            setElapsedSec(0);
          }
          if (s === "idle") {
            connectedAtRef.current = null;
            setEndReason(null);
            setError(null);
            setMuted(false);
            setCameraOff(false);
            setCurrentMedia("audio");
          }
        },
        onIncoming: (name, media) => {
          setIncomingCaller(name);
          setIncomingMedia(media);
          setCurrentMedia(media);
        },
        onRemoteStream: (stream) => setRemoteStream(stream),
        onLocalStream: (stream) => setLocalStream(stream),
        onEnded: (reason) => {
          setEndReason(reason);
          setRemoteStream(null);
          setLocalStream(null);
        },
        onError: (msg) => setError(msg),
      },
    });
    callRef.current = call;
    return () => {
      callRef.current = null;
      void call.close();
    };
  }, [
    props.conversationId,
    props.selfAccountId,
    props.selfDisplayName,
    props.disabled,
  ]);

  // Attach remote stream to the audio element (voice) or video element
  // (video call — video element also plays audio, so the hidden audio
  // sink is a no-op then).
  React.useEffect(() => {
    const audioEl = remoteAudioRef.current;
    const videoEl = remoteVideoRef.current;
    if (currentMedia === "video" && videoEl) {
      videoEl.srcObject = remoteStream;
      if (remoteStream) void videoEl.play().catch(() => { /* autoplay */ });
      if (audioEl) audioEl.srcObject = null;
    } else if (audioEl) {
      audioEl.srcObject = remoteStream;
      if (remoteStream) void audioEl.play().catch(() => { /* autoplay */ });
      if (videoEl) videoEl.srcObject = null;
    }
  }, [remoteStream, currentMedia]);

  // Attach local stream to the local video PIP (video calls only).
  React.useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    if (currentMedia === "video" && localStream) {
      el.srcObject = localStream;
      void el.play().catch(() => { /* autoplay */ });
    } else {
      el.srcObject = null;
    }
  }, [localStream, currentMedia]);

  // Tick the call-duration timer while connected.
  React.useEffect(() => {
    if (state !== "connected") return;
    const t = setInterval(() => {
      if (connectedAtRef.current) {
        setElapsedSec(Math.floor((Date.now() - connectedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [state]);

  if (props.disabled) return null;

  const startVoice = async () => {
    setError(null);
    setCurrentMedia("audio");
    try {
      await callRef.current?.startVoiceCall();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const startVideo = async () => {
    setError(null);
    setCurrentMedia("video");
    try {
      await callRef.current?.startVideoCall();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const accept  = () => { void callRef.current?.acceptIncoming(); };
  const decline = () => { void callRef.current?.declineIncoming(); };
  const hangup  = () => { void callRef.current?.hangup(); };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    callRef.current?.setMuted(next);
  };
  const toggleCamera = () => {
    const next = !cameraOff;
    setCameraOff(next);
    callRef.current?.setCameraOff(next);
  };

  const showOverlay = state !== "idle";
  const peerName = incomingCaller || props.peerDisplayName;

  return (
    <>
      {/* Compact call buttons · top-left, symmetric with the top-right
          home/cart/shop cluster. Voice + video side-by-side. Hidden
          while a call is active — the overlay takes over. */}
      {state === "idle" && (
        <div
          data-nex-call-buttons
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0) + 14px)",
            left: 12,
            display: "flex",
            gap: 2,
            zIndex: 6,
          }}
        >
          <button
            type="button"
            onClick={startVoice}
            aria-label={`Voice-call ${props.peerDisplayName}`}
            title="Voice call"
            style={CALL_BUTTON_STYLE}
          >
            <PhoneIcon />
          </button>
          <button
            type="button"
            onClick={startVideo}
            aria-label={`Video-call ${props.peerDisplayName}`}
            title="Video call"
            style={CALL_BUTTON_STYLE}
          >
            <VideoIcon />
          </button>
        </div>
      )}

      {/* Full-screen call overlay */}
      {showOverlay && (
        <CallOverlay
          state={state}
          peerName={peerName}
          peerAvatarUrl={props.peerAvatarUrl ?? null}
          endReason={endReason}
          error={error}
          muted={muted}
          cameraOff={cameraOff}
          media={currentMedia}
          incomingMedia={incomingMedia}
          elapsedSec={elapsedSec}
          remoteVideoRef={remoteVideoRef}
          localVideoRef={localVideoRef}
          hasRemoteVideo={!!remoteStream && currentMedia === "video"}
          hasLocalVideo={!!localStream && currentMedia === "video"}
          onAccept={accept}
          onDecline={decline}
          onHangup={hangup}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
        />
      )}

      {/* Hidden audio sink for the remote stream. autoPlay + playsInline
          + srcObject are all required for iOS Safari. */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ display: "none" }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Full-screen call overlay                                            *
 * ------------------------------------------------------------------ */

interface OverlayProps {
  state: PeerCallState;
  peerName: string;
  peerAvatarUrl: string | null;
  endReason: PeerCallEndReason | null;
  error: string | null;
  muted: boolean;
  cameraOff: boolean;
  media: PeerCallMedia;
  incomingMedia: PeerCallMedia;
  elapsedSec: number;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  hasRemoteVideo: boolean;
  hasLocalVideo: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
}

function CallOverlay(p: OverlayProps): React.JSX.Element {
  const isIncoming = p.state === "incoming";
  const isEnded = p.state === "ended";
  const showFullBleedVideo = p.media === "video" && p.state === "connected";
  const label = statusLabel(p.state, p.endReason, p.media, isIncoming ? p.incomingMedia : p.media);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label} · ${p.peerName}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: showFullBleedVideo ? "#000" : NEX.bg,
        color: NEX.text,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding:
          "calc(env(safe-area-inset-top, 0) + 40px) 24px calc(env(safe-area-inset-bottom, 0) + 40px)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        backdropFilter: showFullBleedVideo ? undefined : "blur(20px)",
      }}
    >
      {/* Remote video fills the whole overlay when video-connected · rendered
          FIRST so subsequent content sits on top. */}
      {p.media === "video" && (
        <video
          ref={p.remoteVideoRef}
          autoPlay
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "#000",
            opacity: p.hasRemoteVideo ? 1 : 0,
            transition: "opacity 240ms ease",
            zIndex: 0,
          }}
        />
      )}

      {/* Local video PIP · top-right corner, ~120x160, rounded */}
      {p.media === "video" && p.hasLocalVideo && !isIncoming && (
        <video
          ref={p.localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0) + 16px)",
            right: 16,
            width: 108,
            height: 144,
            objectFit: "cover",
            borderRadius: 14,
            border: "2px solid rgba(255,255,255,0.35)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            zIndex: 2,
            transform: "scaleX(-1)", // mirror self-view so it feels natural
            background: "#000",
          }}
        />
      )}

      {/* Top: state + peer identity — hidden when full-bleed video is showing */}
      {!showFullBleedVideo ? (
        <div style={{ textAlign: "center", width: "100%", position: "relative", zIndex: 1 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: p.state === "connected" ? NEX.green : NEX.textDim,
              fontWeight: 700,
              marginBottom: 20,
            }}
          >
            {label}
          </div>
          <PeerAvatar name={p.peerName} url={p.peerAvatarUrl} />
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginTop: 20,
              letterSpacing: "-0.01em",
            }}
          >
            {p.peerName}
          </div>
          {p.state === "connected" && (
            <div
              style={{
                fontSize: 15,
                color: NEX.textDim,
                marginTop: 8,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatDuration(p.elapsedSec)}
            </div>
          )}
          {p.error && (
            <div
              style={{
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(255,51,85,0.12)",
                border: "1px solid rgba(255,51,85,0.35)",
                color: "#FFB4C0",
                fontSize: 13,
                display: "inline-block",
              }}
            >
              {p.error}
            </div>
          )}
        </div>
      ) : (
        // In-call video mode · just show a compact name+timer pill on top.
        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "inline-flex",
            gap: 10,
            alignItems: "center",
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.55)",
            fontSize: 13,
            fontWeight: 700,
            backdropFilter: "blur(8px)",
          }}
        >
          <span>{p.peerName}</span>
          <span style={{ color: NEX.green, fontVariantNumeric: "tabular-nums" }}>
            {formatDuration(p.elapsedSec)}
          </span>
        </div>
      )}

      {/* Bottom: controls */}
      <div
        style={{
          display: "flex",
          gap: 20,
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        {isIncoming ? (
          <>
            <RoundButton kind="danger" onClick={p.onDecline} label="Decline">
              <HangupIcon />
            </RoundButton>
            <RoundButton
              kind="accept"
              onClick={p.onAccept}
              label={p.incomingMedia === "video" ? "Accept video" : "Accept"}
            >
              {p.incomingMedia === "video" ? <VideoIcon /> : <PhoneIcon />}
            </RoundButton>
          </>
        ) : isEnded ? (
          <div style={{ fontSize: 13, color: NEX.textDim }}>
            Closing…
          </div>
        ) : (
          <>
            <RoundButton
              kind={p.muted ? "active" : "neutral"}
              onClick={p.onToggleMute}
              label={p.muted ? "Unmute" : "Mute"}
            >
              {p.muted ? <MicOffIcon /> : <MicIcon />}
            </RoundButton>
            {p.media === "video" && (
              <RoundButton
                kind={p.cameraOff ? "active" : "neutral"}
                onClick={p.onToggleCamera}
                label={p.cameraOff ? "Camera on" : "Camera off"}
              >
                {p.cameraOff ? <VideoOffIcon /> : <VideoIcon />}
              </RoundButton>
            )}
            <RoundButton kind="danger" onClick={p.onHangup} label="Hang up">
              <HangupIcon />
            </RoundButton>
          </>
        )}
      </div>
    </div>
  );
}

function statusLabel(
  state: PeerCallState,
  endReason: PeerCallEndReason | null,
  media: PeerCallMedia,
  incomingMedia: PeerCallMedia,
): string {
  switch (state) {
    case "dialing":    return media === "video" ? "Video calling…" : "Calling…";
    case "incoming":   return incomingMedia === "video" ? "Incoming video call" : "Incoming call";
    case "connecting": return "Connecting…";
    case "connected":  return media === "video" ? "In video call" : "In call";
    case "ended":      return endReasonLabel(endReason);
    case "idle":       return "";
  }
}

function endReasonLabel(r: PeerCallEndReason | null): string {
  switch (r) {
    case "peer-declined": return "Declined";
    case "peer-hangup":   return "Call ended";
    case "hangup":        return "You ended the call";
    case "declined":      return "You declined";
    case "unanswered":    return "No answer";
    case "error":         return "Call failed";
    case null:            return "Call ended";
  }
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return `${mm}:${ss}`;
}

/* ------------------------------------------------------------------ *
 * Small UI primitives                                                 *
 * ------------------------------------------------------------------ */

function PeerAvatar({
  name,
  url,
}: {
  name: string;
  url: string | null;
}): React.JSX.Element {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
  return (
    <div
      aria-hidden
      style={{
        width: 128,
        height: 128,
        borderRadius: "50%",
        background: url
          ? `url(${url}) center/cover`
          : "linear-gradient(135deg, rgba(0,175,255,0.25) 0%, rgba(0,175,255,0.10) 100%)",
        border: "2px solid rgba(0,175,255,0.35)",
        boxShadow:
          "0 12px 40px rgba(0,175,255,0.20), 0 0 0 6px rgba(0,175,255,0.06)",
        display: "grid",
        placeItems: "center",
        color: NEX.text,
        fontSize: 40,
        fontWeight: 700,
        letterSpacing: "-0.02em",
      }}
    >
      {url ? "" : initials || "?"}
    </div>
  );
}

function RoundButton({
  kind,
  onClick,
  label,
  children,
}: {
  kind: "accept" | "danger" | "neutral" | "active";
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const palette: Record<typeof kind, { bg: string; color: string; border: string }> = {
    accept:  { bg: NEX.green,               color: "#02120A", border: "rgba(22,214,107,0.35)" },
    danger:  { bg: NEX.red,                 color: "#160204", border: "rgba(255,51,85,0.35)" },
    neutral: { bg: "rgba(255,255,255,0.08)", color: NEX.text, border: "rgba(255,255,255,0.16)" },
    active:  { bg: "rgba(0,175,255,0.20)",  color: NEX.accent, border: "rgba(0,175,255,0.45)" },
  };
  const p = palette[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: p.bg,
        color: p.color,
        border: `1px solid ${p.border}`,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
        transition: "transform 120ms ease",
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.94)"; }}
      onMouseUp={(e)   => { e.currentTarget.style.transform = "scale(1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Icons · inline SVG so no dependency required                        *
 * ------------------------------------------------------------------ */

function PhoneIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.35 1.84.6 2.8.72a2 2 0 0 1 1.72 2z" />
    </svg>
  );
}
function HangupIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.35 1.84.6 2.8.72a2 2 0 0 1 1.72 2z"
        transform="rotate(135 12 12)" />
    </svg>
  );
}
function MicIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={9} y={2} width={6} height={12} rx={3} />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
      <line x1={12} y1={19} x2={12} y2={22} />
      <line x1={8} y1={22} x2={16} y2={22} />
    </svg>
  );
}
function MicOffIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1={1} y1={1} x2={23} y2={23} />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1={12} y1={19} x2={12} y2={22} />
      <line x1={8} y1={22} x2={16} y2={22} />
    </svg>
  );
}
function VideoIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x={1} y={5} width={15} height={14} rx={2} ry={2} />
    </svg>
  );
}
function VideoOffIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1={1} y1={1} x2={23} y2={23} />
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
    </svg>
  );
}
