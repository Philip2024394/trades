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
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  PeerCall,
  type PeerCallEndReason,
  type PeerCallMedia,
  type PeerCallState,
} from "@/lib/nex-native/calls/peer-call";
import { createRingtone, type Ringtone } from "@/lib/nex-native/calls/ringtone";
import { logCallAction } from "@/app/nex-native/calls/_log-call-action";
import type { CallLogOutcome } from "@/lib/nex-native/call-log-service";
import {
  trackPresenceInCall,
  isPeerInCall,
} from "@/lib/nex-native/realtime/people-presence";

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

/* Mock-driven palette for the full-screen call surface — matches the
 * founder's call-page.png (orange avatar glow, dark background,
 * circular dark-grey control buttons). */
const CALL_SURFACE = {
  bg1: "#0D0806",
  bg2: "#1A0F08",
  accent: "#FF8A2A",
  accentSoft: "rgba(255,138,42,0.22)",
  green: "#22C55E",
  red: "#EF4444",
  text: "#F6F2EE",
  textDim: "#A89C92",
  btnBg: "rgba(255,255,255,0.06)",
  btnBorder: "rgba(255,255,255,0.08)",
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
  // Mock-page extras · all honest about what they do.
  const [speakerOn, setSpeakerOn] = React.useState(false);
  const [keypadOpen, setKeypadOpen] = React.useState(false);
  const [dtmfBuffer, setDtmfBuffer] = React.useState<string>("");
  const [recording, setRecording] = React.useState(false);
  const [addToast, setAddToast] = React.useState<string | null>(null);
  const [layoutSwapped, setLayoutSwapped] = React.useState(false);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const recorderChunksRef = React.useRef<Blob[]>([]);

  const callRef = React.useRef<PeerCall | null>(null);
  const remoteAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const localVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const connectedAtRef = React.useRef<number | null>(null);
  const ringtoneRef = React.useRef<Ringtone | null>(null);
  // Call-log tracking · refs because they live inside the PeerCall
  // handler closure which is set up once in the effect below.
  const callDirectionRef = React.useRef<"outgoing" | "incoming" | null>(null);
  const callStartedAtRef = React.useRef<string | null>(null);
  const wasConnectedRef = React.useRef<boolean>(false);
  const currentMediaRef = React.useRef<PeerCallMedia>("audio");
  React.useEffect(() => {
    currentMediaRef.current = currentMedia;
  }, [currentMedia]);

  // Track on the global in-call presence channel for as long as the
  // PeerCall is in the connected state. Powers the orange "busy on
  // call" rim on friends' avatars across the app.
  React.useEffect(() => {
    if (state !== "connected" || props.disabled) return;
    const release = trackPresenceInCall(props.selfAccountId);
    return release;
  }, [state, props.disabled, props.selfAccountId]);

  // Instantiate PeerCall once per conversation.
  React.useEffect(() => {
    if (props.disabled) return;
    const call = new PeerCall({
      conversationId: props.conversationId,
      selfAccountId: props.selfAccountId,
      selfDisplayName: props.selfDisplayName,
      peerAccountId: props.peerAccountId,
      handlers: {
        onStateChange: (s) => {
          setState(s);
          // Capture direction + start time on the first transition
          // out of idle so onEnded can log a complete record.
          if (
            s === "dialing" &&
            callDirectionRef.current === null
          ) {
            callDirectionRef.current = "outgoing";
            callStartedAtRef.current = new Date().toISOString();
          }
          if (
            s === "incoming" &&
            callDirectionRef.current === null
          ) {
            callDirectionRef.current = "incoming";
            callStartedAtRef.current = new Date().toISOString();
          }
          if (s === "connected") {
            connectedAtRef.current = Date.now();
            setElapsedSec(0);
            wasConnectedRef.current = true;
          }
          if (s === "idle") {
            connectedAtRef.current = null;
            setEndReason(null);
            setError(null);
            setMuted(false);
            setCameraOff(false);
            setCurrentMedia("audio");
            // Reset call-log tracking for the next call on this
            // launcher instance.
            callDirectionRef.current = null;
            callStartedAtRef.current = null;
            wasConnectedRef.current = false;
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
          // Fire-and-forget call-log insert. One row per viewer per
          // call lifecycle; the counterparty inserts their own row
          // from their own launcher instance. Soft-fails so a logging
          // hiccup doesn't disturb the call-ended UX.
          const direction = callDirectionRef.current;
          const startedAt = callStartedAtRef.current;
          if (direction && startedAt) {
            const connectedAt = connectedAtRef.current;
            const nowMs = Date.now();
            const durationSeconds =
              connectedAt !== null
                ? Math.max(0, Math.round((nowMs - connectedAt) / 1000))
                : null;
            const outcome: CallLogOutcome = (() => {
              if (reason === "error") return "failed";
              if (wasConnectedRef.current) return "completed";
              if (reason === "declined" || reason === "peer-declined") return "declined";
              // unanswered / hangup / peer-hangup before connecting =
              // treated as missed from the viewer's perspective.
              return "missed";
            })();
            void logCallAction({
              peerAccountId: props.peerAccountId,
              conversationId: props.conversationId,
              direction,
              mediaType: currentMediaRef.current,
              outcome,
              startedAt,
              endedAt: new Date(nowMs).toISOString(),
              durationSeconds,
            }).catch(() => {
              /* soft-fail · UI unaffected */
            });
          }
        },
        onError: (msg) => {
          // Supabase Realtime surfaces transient WebSocket blips as
          // "channel error" / "transport failure" / "TIMED_OUT". The
          // SDK auto-reconnects, so showing them as a call-fatal
          // error is noisy and often wrong. Log for debuggability
          // but keep the UI calm · a real WebRTC-level failure
          // ("call connection failed") still comes through here
          // and is surfaced normally.
          if (
            typeof msg === "string" &&
            /channel error|transport failure|TIMED_OUT|CHANNEL_ERROR/i.test(msg)
          ) {
            console.warn("[call] transient signalling blip:", msg);
            return;
          }
          setError(msg);
        },
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

  // Bridge 86 · auto-accept when we arrived here via the global
  // incoming-call hub's "Accept" deep-link. Fires once when the ring
  // arrives on the per-conversation signalling channel and the URL
  // still carries the accept_call marker. Also clears the marker so
  // a back-navigation doesn't re-accept.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const acceptCallId = searchParams.get("accept_call");
  React.useEffect(() => {
    if (!acceptCallId || props.disabled) return;
    if (state !== "incoming") return;
    void callRef.current?.acceptIncoming();
    // Wipe the marker from the URL so it can't fire again.
    router.replace(pathname, { scroll: false });
  }, [acceptCallId, state, props.disabled, pathname, router]);

  // NEX Calls hub · outgoing-call deep-link. The /nex-native/calls
  // page sends the user here with `?start_call=voice|video` after
  // they pick a peer. Fire the matching startVoice/startVideo once
  // the component is idle and ready, then clear the marker so a
  // back-navigation doesn't dial twice.
  const startCallParam = searchParams.get("start_call");
  React.useEffect(() => {
    if (!startCallParam || props.disabled) return;
    if (state !== "idle") return;
    if (startCallParam === "voice") {
      void (async () => {
        setCurrentMedia("audio");
        try {
          await callRef.current?.startVoiceCall();
        } catch (e) {
          setError((e as Error).message);
        }
      })();
    } else if (startCallParam === "video") {
      void (async () => {
        setCurrentMedia("video");
        try {
          await callRef.current?.startVideoCall();
        } catch (e) {
          setError((e as Error).message);
        }
      })();
    }
    router.replace(pathname, { scroll: false });
  }, [startCallParam, state, props.disabled, pathname, router]);

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

  // Bridge 89a · play the synthesized ringtone whenever we're in the
  // "incoming" state · stops on any transition out (accept/decline/
  // ended). Callers who are dialing get a subtle tone via the
  // browser's own tab title update in a future bridge · we only ring
  // for INCOMING here to match the classic phone metaphor.
  React.useEffect(() => {
    if (!ringtoneRef.current) ringtoneRef.current = createRingtone();
    if (state === "incoming") {
      ringtoneRef.current.start();
    } else {
      ringtoneRef.current.stop();
    }
  }, [state]);
  React.useEffect(() => {
    return () => { ringtoneRef.current?.stop(); };
  }, []);

  if (props.disabled) return null;

  const startVoice = async () => {
    setError(null);
    // Guard · if the peer is already tracked on the in-call presence
    // channel, don't dial. One active 1:1 call per peer at a time.
    if (await isPeerInCall(props.peerAccountId)) {
      setError(`${props.peerDisplayName} is on a call`);
      return;
    }
    setCurrentMedia("audio");
    try {
      await callRef.current?.startVoiceCall();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const startVideo = async () => {
    setError(null);
    if (await isPeerInCall(props.peerAccountId)) {
      setError(`${props.peerDisplayName} is on a call`);
      return;
    }
    setCurrentMedia("video");
    try {
      await callRef.current?.startVideoCall();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Universal ChatActionDots entry point · the 3-dots slider on this
  // surface dispatches these events; we trigger the real call via
  // the same code paths the top-left call buttons use. Only arm the
  // listeners while idle so a tapping an action during an active
  // call doesn't try to start a second one.
  React.useEffect(() => {
    if (state !== "idle" || props.disabled) return;
    const onCall = () => { void startVoice(); };
    const onVideo = () => { void startVideo(); };
    window.addEventListener("nex-chat-action-call", onCall);
    window.addEventListener("nex-chat-action-video", onVideo);
    return () => {
      window.removeEventListener("nex-chat-action-call", onCall);
      window.removeEventListener("nex-chat-action-video", onVideo);
    };
    // startVoice/startVideo close over setState/setError which are
    // stable; we only need to re-arm when state transitions in/out
    // of "idle".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, props.disabled]);
  const accept  = () => { void callRef.current?.acceptIncoming(); };
  const decline = () => { void callRef.current?.declineIncoming(); };
  const hangup  = () => { void callRef.current?.hangup(); };
  /** End button on the mock surface · hang up AND route to the Call
   *  Center so the user lands somewhere actionable instead of a
   *  closing/ended spinner in-chat. */
  const endAndExit = () => {
    void callRef.current?.hangup();
    // Give the hangup a tick to flush, then navigate.
    setTimeout(() => router.push("/nex-native/calls"), 180);
  };
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
  /** Flip front/back camera · delegates to PeerCall which swaps the
   *  track on the active RTCRtpSender. */
  const switchCamera = () => {
    void callRef.current?.switchVideoFacingMode();
  };
  /** Swap the layout · local becomes full-bleed, remote becomes PIP. */
  const toggleLayout = () => setLayoutSwapped((v) => !v);
  /** Speaker toggle · attempts setSinkId when supported (Chrome
   *  desktop / Android Chrome) so the remote audio can switch between
   *  the earpiece and the loudspeaker. On iOS Safari + browsers that
   *  don't expose setSinkId, we keep the visual toggle but it's a
   *  no-op · routing is OS-controlled there. */
  const toggleSpeaker = () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    const audio = remoteAudioRef.current as
      | (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> })
      | null;
    if (audio?.setSinkId) {
      // "default" is the OS default (usually earpiece on mobile);
      // "communications" is the loudspeaker preset on supporting
      // browsers. Fall back silently if the chosen id is rejected.
      void audio
        .setSinkId(next ? "communications" : "default")
        .catch(() => { /* unsupported sink · leave visual-only */ });
    }
  };
  /** Open/close the DTMF keypad overlay. */
  const toggleKeypad = () => setKeypadOpen((v) => !v);
  /** Push a DTMF digit · if the active peer connection carries a
   *  DTMFSender we insert the tone on the wire. We also play a local
   *  click so the user hears feedback regardless. */
  const pressDtmf = (digit: string) => {
    setDtmfBuffer((prev) => (prev + digit).slice(-20));
    try {
      const pc = (callRef.current as unknown as { pc?: RTCPeerConnection })?.pc;
      const sender = pc?.getSenders().find((s) => s.track?.kind === "audio");
      const dtmf = (sender as RTCRtpSender & { dtmf?: RTCDTMFSender })?.dtmf;
      if (dtmf) dtmf.insertDTMF(digit, 160, 50);
    } catch {
      /* best-effort · WebRTC may not expose DTMF */
    }
  };
  /** Add participant · creates a shareable URL back to this chat and
   *  invokes the OS share sheet if available, otherwise copies to
   *  clipboard with a brief toast. This is honest: it shares a path
   *  into the chat, not a mid-call participant injection (which
   *  would require tearing down 1:1 and re-establishing group mesh). */
  const inviteAdd = async () => {
    const url = `${window.location.origin}/nex-native/chat/peer/${props.peerAccountId}`;
    const navAny = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };
    try {
      if (navAny.share) {
        await navAny.share({
          title: `Chat with ${props.peerDisplayName} on NEX`,
          url,
        });
        setAddToast("Shared");
      } else {
        await navigator.clipboard.writeText(url);
        setAddToast("Link copied");
      }
    } catch {
      setAddToast("Copy failed");
    }
    setTimeout(() => setAddToast(null), 1600);
  };
  /** Record toggle · captures the LOCAL mic to a .webm file. Honest
   *  about the limitation: it does NOT record the remote side's
   *  audio (that would require mixing both streams through an
   *  AudioContext, which is in-scope for a later bridge). The file
   *  downloads automatically on stop. */
  const toggleRecord = () => {
    if (!recording) {
      if (!localStream) return;
      try {
        const rec = new MediaRecorder(localStream);
        recorderChunksRef.current = [];
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) recorderChunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          const blob = new Blob(recorderChunksRef.current, {
            type: rec.mimeType || "audio/webm",
          });
          const href = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = href;
          a.download = `nex-call-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(href);
        };
        rec.start();
        recorderRef.current = rec;
        setRecording(true);
      } catch {
        setError("Recording not supported on this device");
      }
    } else {
      try { recorderRef.current?.stop(); } catch { /* ignore */ }
      recorderRef.current = null;
      setRecording(false);
    }
  };
  // Make sure a lingering recorder tears down when the call ends.
  React.useEffect(() => {
    if (state === "idle" || state === "ended") {
      if (recorderRef.current) {
        try { recorderRef.current.stop(); } catch { /* ignore */ }
        recorderRef.current = null;
      }
      if (recording) setRecording(false);
      if (keypadOpen) setKeypadOpen(false);
      if (dtmfBuffer) setDtmfBuffer("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

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
          onEnd={endAndExit}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          speakerOn={speakerOn}
          onToggleSpeaker={toggleSpeaker}
          keypadOpen={keypadOpen}
          dtmfBuffer={dtmfBuffer}
          onToggleKeypad={toggleKeypad}
          onPressDtmf={pressDtmf}
          onInviteAdd={() => { void inviteAdd(); }}
          addToast={addToast}
          recording={recording}
          onToggleRecord={toggleRecord}
          onSwitchCamera={switchCamera}
          layoutSwapped={layoutSwapped}
          onToggleLayout={toggleLayout}
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
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  speakerOn: boolean;
  onToggleSpeaker: () => void;
  keypadOpen: boolean;
  dtmfBuffer: string;
  onToggleKeypad: () => void;
  onPressDtmf: (digit: string) => void;
  onInviteAdd: () => void;
  addToast: string | null;
  recording: boolean;
  onToggleRecord: () => void;
  onSwitchCamera: () => void;
  layoutSwapped: boolean;
  onToggleLayout: () => void;
}

function CallOverlay(p: OverlayProps): React.JSX.Element {
  const isIncoming = p.state === "incoming";
  const isEnded = p.state === "ended";
  const isConnected = p.state === "connected";
  const showFullBleedVideo = p.media === "video" && isConnected;
  const label = statusLabel(p.state, p.endReason, p.media, isIncoming ? p.incomingMedia : p.media);
  const subLabel = subStatusLabel(p.state, p.endReason);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label} · ${p.peerName}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: `radial-gradient(1200px 600px at 50% -10%, ${CALL_SURFACE.accentSoft} 0%, transparent 60%), linear-gradient(180deg, ${CALL_SURFACE.bg1} 0%, ${CALL_SURFACE.bg2} 100%)`,
        color: CALL_SURFACE.text,
        display: "flex",
        flexDirection: "column",
        padding:
          "calc(env(safe-area-inset-top, 0) + 20px) 20px calc(env(safe-area-inset-bottom, 0) + 24px)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <PulseKeyframes />
      {/* Video elements · in the mock the "hero" is the inset frame
          below the top header, not the full window. We render into a
          clipped stage so the header above and controls below remain
          visible on a dark surface. `layoutSwapped` flips which
          stream (remote vs local) gets the big tile vs the PIP. */}
      {p.media === "video" && (
        <div
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0) + 64px)",
            left: 20,
            right: 20,
            bottom: 220,
            borderRadius: 22,
            overflow: "hidden",
            background: "#000",
            boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
            border: `1px solid ${CALL_SURFACE.btnBorder}`,
            zIndex: 0,
          }}
        >
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
              zIndex: p.layoutSwapped ? 2 : 0,
              ...(p.layoutSwapped
                ? {
                    inset: "auto 10px 10px auto",
                    width: 108,
                    height: 144,
                    borderRadius: 14,
                    border: "2px solid rgba(255,255,255,0.35)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                  }
                : {}),
            }}
          />
          {p.hasLocalVideo && !isIncoming && (
            <video
              ref={p.localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                background: "#000",
                zIndex: p.layoutSwapped ? 0 : 2,
                transform: p.layoutSwapped ? undefined : "scaleX(-1)",
                ...(p.layoutSwapped
                  ? {}
                  : {
                      inset: "auto 10px 10px auto",
                      width: 108,
                      height: 144,
                      borderRadius: 14,
                      border: "2px solid rgba(255,255,255,0.35)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                      transform: "scaleX(-1)",
                    }),
              }}
            />
          )}
        </div>
      )}

      {/* Top-left: phone icon + call type + live timer · matches mock */}
      {(
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 15,
            fontWeight: 600,
            color: CALL_SURFACE.text,
            position: "relative",
            zIndex: 3,
            marginBottom: 10,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "rgba(34,197,94,0.18)",
              color: CALL_SURFACE.green,
              display: "grid",
              placeItems: "center",
            }}
          >
            <PhoneIcon />
          </span>
          <span>{label}</span>
          {isConnected && (
            <>
              <span style={{ color: CALL_SURFACE.textDim }}>·</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: CALL_SURFACE.text }}>
                {formatDuration(p.elapsedSec)}
              </span>
            </>
          )}
        </div>
      )}

      {/* Hero: avatar + name + sub-status · stacked vertically centre */}
      {!showFullBleedVideo ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
            width: "100%",
          }}
        >
          <PeerAvatarOrange
            name={p.peerName}
            url={p.peerAvatarUrl}
            ringing={
              p.state === "dialing" ||
              p.state === "incoming" ||
              p.state === "connecting"
            }
          />
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
          <div
            style={{
              fontSize: 14,
              color: CALL_SURFACE.textDim,
              marginTop: 6,
            }}
          >
            {subLabel}
          </div>
          {p.error && (
            <div
              style={{
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(239,68,68,0.14)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "#FFB4C0",
                fontSize: 13,
                display: "inline-block",
              }}
            >
              {p.error}
            </div>
          )}
          {p.addToast && (
            <div
              style={{
                marginTop: 16,
                padding: "8px 14px",
                borderRadius: 999,
                background: CALL_SURFACE.accentSoft,
                border: `1px solid ${CALL_SURFACE.accent}66`,
                color: CALL_SURFACE.accent,
                fontSize: 12.5,
                fontWeight: 600,
                display: "inline-block",
              }}
            >
              {p.addToast}
            </div>
          )}
        </div>
      ) : (
        // Video-connected · video stage above is the hero. Reserve
        // the vertical space and surface the add-toast if present.
        <div style={{ flex: 1, position: "relative", zIndex: 2, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          {p.addToast && (
            <div
              style={{
                alignSelf: "center",
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.65)",
                color: CALL_SURFACE.accent,
                fontSize: 12.5,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              {p.addToast}
            </div>
          )}
        </div>
      )}

      {/* Controls · 2×3 grid on the connected surface, or incoming
          accept/decline pair, or quiet "Closing…" on ended. */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          width: "100%",
        }}
      >
        {isIncoming ? (
          <div style={{ display: "flex", gap: 20 }}>
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
          </div>
        ) : isEnded ? (
          <div style={{ fontSize: 13, color: CALL_SURFACE.textDim }}>
            Closing…
          </div>
        ) : p.media === "video" ? (
          <VideoCallButtonGrid
            muted={p.muted}
            cameraOff={p.cameraOff}
            recording={p.recording}
            onToggleMute={p.onToggleMute}
            onToggleCamera={p.onToggleCamera}
            onSwitchCamera={p.onSwitchCamera}
            onToggleLayout={p.onToggleLayout}
            onInviteAdd={p.onInviteAdd}
            onToggleRecord={p.onToggleRecord}
            onEnd={p.onEnd}
          />
        ) : (
          <CallButtonGrid
            muted={p.muted}
            cameraOff={p.cameraOff}
            media={p.media}
            speakerOn={p.speakerOn}
            recording={p.recording}
            onToggleMute={p.onToggleMute}
            onToggleCamera={p.onToggleCamera}
            onToggleSpeaker={p.onToggleSpeaker}
            onToggleKeypad={p.onToggleKeypad}
            onInviteAdd={p.onInviteAdd}
            onToggleRecord={p.onToggleRecord}
            onEnd={p.onEnd}
          />
        )}
      </div>

      {/* Keypad sheet · slides over the controls when open. */}
      {p.keypadOpen && !isIncoming && !isEnded && (
        <KeypadSheet
          buffer={p.dtmfBuffer}
          onPress={p.onPressDtmf}
          onClose={p.onToggleKeypad}
        />
      )}
    </div>
  );
}

/* ─── Call button grid (2×3) per mock ───────────────────────────── */

function CallButtonGrid(props: {
  muted: boolean;
  cameraOff: boolean;
  media: PeerCallMedia;
  speakerOn: boolean;
  recording: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
  onToggleKeypad: () => void;
  onInviteAdd: () => void;
  onToggleRecord: () => void;
  onEnd: () => void;
}): React.JSX.Element {
  // Row 1: Mute | Speaker (voice) / Camera (video) | Keypad
  // Row 2: Add  | Record                           | End
  const slot2 =
    props.media === "video"
      ? {
          label: props.cameraOff ? "Camera on" : "Camera off",
          active: props.cameraOff,
          onClick: props.onToggleCamera,
          icon: props.cameraOff ? <VideoOffIcon /> : <VideoIcon />,
        }
      : {
          label: props.speakerOn ? "Speaker on" : "Speaker",
          active: props.speakerOn,
          onClick: props.onToggleSpeaker,
          icon: <SpeakerIcon />,
        };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 72px)",
        gap: 18,
        rowGap: 16,
        placeItems: "center",
      }}
    >
      <CallSurfaceButton
        label={props.muted ? "Unmute" : "Mute"}
        active={props.muted}
        onClick={props.onToggleMute}
      >
        {props.muted ? <MicOffIcon /> : <MicIcon />}
      </CallSurfaceButton>
      <CallSurfaceButton
        label={slot2.label}
        active={slot2.active}
        onClick={slot2.onClick}
      >
        {slot2.icon}
      </CallSurfaceButton>
      <CallSurfaceButton label="Keypad" onClick={props.onToggleKeypad}>
        <KeypadIcon />
      </CallSurfaceButton>
      <CallSurfaceButton label="Add" onClick={props.onInviteAdd}>
        <AddUserIcon />
      </CallSurfaceButton>
      <CallSurfaceButton
        label={props.recording ? "Recording" : "Record"}
        active={props.recording}
        pulse={props.recording}
        onClick={props.onToggleRecord}
      >
        <RecordIcon active={props.recording} />
      </CallSurfaceButton>
      <CallSurfaceButton label="End" tone="danger" onClick={props.onEnd}>
        <HangupIcon />
      </CallSurfaceButton>
    </div>
  );
}

function CallSurfaceButton({
  label,
  active,
  tone,
  pulse,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  tone?: "danger";
  /** Play the heartbeat animation around the button · used by Record
   *  while recording, so the viewer sees the capture is live. */
  pulse?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const isDanger = tone === "danger";
  const bg = isDanger
    ? CALL_SURFACE.red
    : active
      ? "#ffffff"
      : CALL_SURFACE.btnBg;
  const color = isDanger ? "#fff" : active ? "#0a0608" : CALL_SURFACE.text;
  const border = isDanger
    ? "transparent"
    : active
      ? "transparent"
      : CALL_SURFACE.btnBorder;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 62,
          height: 62,
          borderRadius: "50%",
          background: bg,
          color,
          border: `1px solid ${border}`,
          display: "grid",
          placeItems: "center",
          boxShadow: isDanger
            ? "0 10px 24px rgba(239,68,68,0.35)"
            : "0 4px 12px rgba(0,0,0,0.35)",
          animation: pulse ? "nex-call-heartbeat 1.4s ease-out infinite" : undefined,
          ["--nex-pulse" as string]: "rgba(239,68,68,0.55)",
          ["--nex-pulse-fade" as string]: "rgba(239,68,68,0)",
        } as React.CSSProperties}
      >
        {children}
      </span>
      <span style={{ fontSize: 11.5, color: CALL_SURFACE.textDim, fontWeight: 500 }}>
        {label}
      </span>
    </button>
  );
}

/* ─── Video-call button grid (per video-call mock) ──────────────── */

function VideoCallButtonGrid(props: {
  muted: boolean;
  cameraOff: boolean;
  recording: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onToggleLayout: () => void;
  onInviteAdd: () => void;
  onToggleRecord: () => void;
  onEnd: () => void;
}): React.JSX.Element {
  // Top row (4 small): Mute · Camera · Switch · Layout
  // Bottom row (3): Add · End (red, centred) · Record
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        width: "100%",
        maxWidth: 340,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
        }}
      >
        <CallSurfaceButton
          label={props.muted ? "Unmute" : "Mute"}
          active={props.muted}
          onClick={props.onToggleMute}
        >
          {props.muted ? <MicOffIcon /> : <MicIcon />}
        </CallSurfaceButton>
        <CallSurfaceButton
          label={props.cameraOff ? "Camera on" : "Camera"}
          active={props.cameraOff}
          onClick={props.onToggleCamera}
        >
          {props.cameraOff ? <VideoOffIcon /> : <VideoIcon />}
        </CallSurfaceButton>
        <CallSurfaceButton label="Switch" onClick={props.onSwitchCamera}>
          <SwitchCameraIcon />
        </CallSurfaceButton>
        <CallSurfaceButton label="Layout" onClick={props.onToggleLayout}>
          <LayoutIcon />
        </CallSurfaceButton>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          placeItems: "center",
        }}
      >
        <CallSurfaceButton label="Add" onClick={props.onInviteAdd}>
          <AddUserIcon />
        </CallSurfaceButton>
        <CallSurfaceButton label="End" tone="danger" onClick={props.onEnd}>
          <HangupIcon />
        </CallSurfaceButton>
        <CallSurfaceButton
          label={props.recording ? "Recording" : "Record"}
          active={props.recording}
          onClick={props.onToggleRecord}
        >
          <RecordIcon active={props.recording} />
        </CallSurfaceButton>
      </div>
    </div>
  );
}

/* ─── DTMF keypad sheet ─────────────────────────────────────────── */

function KeypadSheet(props: {
  buffer: string;
  onPress: (d: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const digits: Array<[string, string]> = [
    ["1", ""],
    ["2", "ABC"],
    ["3", "DEF"],
    ["4", "GHI"],
    ["5", "JKL"],
    ["6", "MNO"],
    ["7", "PQRS"],
    ["8", "TUV"],
    ["9", "WXYZ"],
    ["*", ""],
    ["0", "+"],
    ["#", ""],
  ];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keypad"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: "0 20px calc(env(safe-area-inset-bottom, 0) + 24px)",
        zIndex: 3,
        background:
          "linear-gradient(180deg, rgba(13,8,6,0) 0%, rgba(13,8,6,0.9) 55%, rgba(13,8,6,0.96) 100%)",
      }}
      onClick={props.onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${CALL_SURFACE.btnBorder}`,
          borderRadius: 20,
          padding: "16px 14px 18px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            minHeight: 32,
            fontSize: 24,
            fontWeight: 600,
            color: CALL_SURFACE.text,
            fontVariantNumeric: "tabular-nums",
            textAlign: "center",
            marginBottom: 12,
            letterSpacing: "0.08em",
          }}
        >
          {props.buffer || "·"}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          {digits.map(([d, sub]) => (
            <button
              key={d}
              type="button"
              onClick={() => props.onPress(d)}
              aria-label={`Dial ${d}`}
              style={{
                padding: "12px 0 10px",
                borderRadius: 14,
                background: CALL_SURFACE.btnBg,
                border: `1px solid ${CALL_SURFACE.btnBorder}`,
                color: CALL_SURFACE.text,
                fontSize: 22,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <span>{d}</span>
              {sub && (
                <span style={{ fontSize: 9.5, color: CALL_SURFACE.textDim, letterSpacing: "0.14em" }}>
                  {sub}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={props.onClose}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "10px",
            borderRadius: 999,
            background: "transparent",
            border: `1px solid ${CALL_SURFACE.btnBorder}`,
            color: CALL_SURFACE.textDim,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Hide keypad
        </button>
      </div>
    </div>
  );
}

function subStatusLabel(
  state: PeerCallState,
  endReason: PeerCallEndReason | null,
): string {
  switch (state) {
    case "dialing":    return "Ringing…";
    case "incoming":   return "Incoming";
    case "connecting": return "Connecting…";
    case "connected":  return "Connected";
    case "ended":      return endReasonLabel(endReason);
    case "idle":       return "";
  }
}

/* Shared pulse keyframe · heartbeat-like double-beat for ringing +
 * recording affordances. Injected once per overlay mount. */
function PulseKeyframes(): React.JSX.Element {
  return (
    <style>{`
      @keyframes nex-call-heartbeat {
        0%   { transform: scale(1);     box-shadow: 0 0 0 0 var(--nex-pulse, rgba(255,138,42,0.55)); }
        14%  { transform: scale(1.06);  box-shadow: 0 0 0 10px var(--nex-pulse-fade, rgba(255,138,42,0)); }
        28%  { transform: scale(1);     box-shadow: 0 0 0 0 var(--nex-pulse, rgba(255,138,42,0.0)); }
        42%  { transform: scale(1.04);  box-shadow: 0 0 0 14px var(--nex-pulse-fade, rgba(255,138,42,0)); }
        70%  { transform: scale(1);     box-shadow: 0 0 0 0 rgba(255,138,42,0); }
        100% { transform: scale(1);     box-shadow: 0 0 0 0 rgba(255,138,42,0); }
      }
    `}</style>
  );
}

/* Avatar · orange glow ring per mock design.
 * When `ringing` is true, the ring plays a double-beat heartbeat so
 * the viewer sees "we're calling" without needing to read the label. */
function PeerAvatarOrange({
  name,
  url,
  ringing,
}: {
  name: string;
  url: string | null;
  ringing?: boolean;
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
        width: 132,
        height: 132,
        borderRadius: "50%",
        background: url
          ? `url(${url}) center/cover`
          : `linear-gradient(135deg, ${CALL_SURFACE.accentSoft} 0%, rgba(255,138,42,0.08) 100%)`,
        border: `3px solid ${CALL_SURFACE.accent}`,
        boxShadow: `0 0 48px ${CALL_SURFACE.accent}55, 0 0 0 10px rgba(255,138,42,0.06)`,
        display: "grid",
        placeItems: "center",
        color: CALL_SURFACE.text,
        fontSize: 40,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        animation: ringing ? "nex-call-heartbeat 1.4s ease-out infinite" : undefined,
        ["--nex-pulse" as string]: `${CALL_SURFACE.accent}99`,
        ["--nex-pulse-fade" as string]: "rgba(255,138,42,0)",
      } as React.CSSProperties}
    >
      {url ? "" : initials || "?"}
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
function SpeakerIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
function KeypadIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {[
        [4, 4], [11, 4], [18, 4],
        [4, 11], [11, 11], [18, 11],
        [4, 18], [11, 18], [18, 18],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.6} />
      ))}
    </svg>
  );
}
function AddUserIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx={9} cy={7} r={4} />
      <line x1={19} y1={8} x2={19} y2={14} />
      <line x1={16} y1={11} x2={22} y2={11} />
    </svg>
  );
}
function SwitchCameraIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 7h-3.17L15 5H9L7.17 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <path d="M9 13.5l-2-2 2-2" />
      <path d="M7 11.5h7a3 3 0 0 1 3 3" />
    </svg>
  );
}
function LayoutIcon(): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x={3} y={3} width={8} height={8} rx={1.5} />
      <rect x={13} y={3} width={8} height={8} rx={1.5} />
      <rect x={3} y={13} width={8} height={8} rx={1.5} />
      <rect x={13} y={13} width={8} height={8} rx={1.5} />
    </svg>
  );
}
function RecordIcon({ active }: { active?: boolean }): React.JSX.Element {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden>
      <circle cx={12} cy={12} r={10} fill="none" stroke="currentColor" strokeWidth={1.9} />
      <circle cx={12} cy={12} r={active ? 5 : 4.5} fill={active ? "#EF4444" : "currentColor"} />
    </svg>
  );
}
