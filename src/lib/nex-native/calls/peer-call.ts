// src/lib/nex-native/calls/peer-call.ts
//
// Bridge 68 · Peer voice-call client · WebRTC + Supabase Realtime.
// -----------------------------------------------------------------
// One instance per open peer conversation. Owns:
//   · the signalling channel subscription (via B67 realtime layer)
//   · the RTCPeerConnection lifecycle
//   · the local microphone MediaStream
//   · the call-state machine (idle → dialing/incoming → connecting →
//     connected → ended → idle)
//
// The UI layer (`_call-launcher.tsx`) drives it via three verbs:
//   startVoiceCall(), acceptIncoming(), declineIncoming()/hangup(),
// and reacts to state / remote-stream / ended / incoming callbacks.
//
// Video is intentionally OUT of scope for B68 — same class will be
// extended in B69 to negotiate video tracks. Everything else (ring
// timeout, ICE queueing, connection-state teardown) is voice-ready.

"use client";

import {
  openSignallingChannel,
  type ByeSignal,
  type IceSignal,
  type RingSignal,
  type SdpAnswerSignal,
  type SdpOfferSignal,
  type SignallingChannel,
} from "../realtime/signalling";
import { openIncomingCallInbox } from "../realtime/incoming-calls";

export type PeerCallState =
  | "idle"
  | "dialing"     // outbound: we've sent ring + offer, waiting for answer
  | "incoming"    // inbound: ring received, waiting for user to accept
  | "connecting"  // both sides negotiating (post-accept, pre-media)
  | "connected"   // audio flowing both ways
  | "ended";      // just torn down · returns to idle after 2s

export type PeerCallEndReason =
  | "hangup"
  | "declined"
  | "unanswered"
  | "peer-hangup"
  | "peer-declined"
  | "error";

export type PeerCallMedia = "audio" | "video";

export interface PeerCallHandlers {
  onStateChange: (state: PeerCallState) => void;
  onIncoming: (callerName: string, media: PeerCallMedia) => void;
  onRemoteStream: (stream: MediaStream) => void;
  /** Fires once the local mic (and camera for video calls) is granted
   *  and captured. UI uses this to attach the local video PIP. */
  onLocalStream?: (stream: MediaStream) => void;
  /** Fires when the media kind changes mid-call · currently unused but
   *  lets the UI show/hide the video PIP if we ever add flip-to-video
   *  or fallback-to-audio. */
  onMediaKindChange?: (media: PeerCallMedia) => void;
  onEnded: (reason: PeerCallEndReason) => void;
  onError?: (msg: string) => void;
}

// Same STUN set as src/lib/nex-calling/webrtc-client.ts — three public
// providers so a single blocked endpoint doesn't stop the connection.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

const RING_TIMEOUT_MS = 45_000;
const IDLE_AFTER_END_MS = 2_000;

interface PendingRing {
  callId: string;
  callerName: string;
  media: PeerCallMedia;
}

export class PeerCall {
  private readonly signalling: SignallingChannel;
  private state: PeerCallState = "idle";
  private role: "caller" | "callee" | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private currentCallId: string | null = null;
  private ringTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private remoteDescriptionSet = false;
  private queuedIce: RTCIceCandidateInit[] = [];
  private pendingRing: PendingRing | null = null;
  private pendingOffer: SdpOfferSignal | null = null;
  private closed = false;
  private currentMedia: PeerCallMedia = "audio";

  constructor(
    private readonly opts: {
      conversationId: string;
      selfAccountId: string;
      selfDisplayName: string;
      /** Bridge 86 · peer's account id · used to also ring their
       *  global inbox (nex:calls:in:{peer_id}) so calls land even
       *  when they aren't viewing this specific chat. */
      peerAccountId: string;
      handlers: PeerCallHandlers;
    },
  ) {
    this.signalling = openSignallingChannel({
      conversationId: opts.conversationId,
      selfAccountId: opts.selfAccountId,
      handlers: {
        onRing:   (s) => this.handleRing(s),
        onOffer:  (s) => this.handleOffer(s),
        onAnswer: (s) => this.handleAnswer(s),
        onIce:    (s) => void this.handleIce(s),
        onBye:    (s) => this.handleBye(s),
        onError:  (e) => opts.handlers.onError?.(e),
      },
    });
  }

  getState(): PeerCallState {
    return this.state;
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.state !== "idle" && this.state !== "ended") {
      const callId = this.currentCallId;
      this.teardown("hangup");
      if (callId) {
        try { await this.signalling.sendBye({ callId, reason: "hangup" }); }
        catch { /* ignore · we're closing anyway */ }
      }
    }
    await this.signalling.close();
  }

  /** Outbound: start a voice call. Requests mic, creates offer, rings peer. */
  async startVoiceCall(): Promise<void> {
    return this.startCall("audio");
  }

  /** Outbound: start a video call. Requests mic + camera, creates offer
   *  with both tracks, rings peer. Callee's UI will show a video-call
   *  ring so they can accept knowing they'll be on camera. */
  async startVideoCall(): Promise<void> {
    return this.startCall("video");
  }

  private async startCall(media: PeerCallMedia): Promise<void> {
    if (this.state !== "idle") {
      throw new Error(`cannot start call from state=${this.state}`);
    }
    this.role = "caller";
    this.currentCallId = generateCallId();
    this.currentMedia = media;
    this.setState("dialing");

    const constraints: MediaStreamConstraints = media === "video"
      ? { audio: true, video: { facingMode: "user" } }
      : { audio: true, video: false };
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      this.opts.handlers.onError?.(
        media === "video"
          ? "camera or microphone permission was denied"
          : "microphone permission was denied",
      );
      this.teardown("error");
      return;
    }
    this.opts.handlers.onLocalStream?.(this.localStream);

    this.pc = this.buildPeerConnection();
    for (const t of this.localStream.getTracks()) this.pc.addTrack(t, this.localStream);

    // Ring first so the peer's UI can show incoming instantly (with
    // the correct media kind), then create + send the offer. Both
    // broadcast on the same channel so ordering is preserved.
    await this.signalling.sendRing({
      callId: this.currentCallId,
      media,
      callerAccountId: this.opts.selfAccountId,
      callerDisplayName: this.opts.selfDisplayName,
    });

    // Bridge 86 · also ring the peer's GLOBAL inbox so the call
    // reaches them wherever they are in nex-native, not just when
    // they happen to be viewing this peer chat. Fire-and-forget ·
    // per-conversation ring is the authoritative signal · this is
    // the discoverability layer on top. Uses a short-lived caller
    // inbox handle that opens, broadcasts, closes.
    void (async () => {
      try {
        const inbox = openIncomingCallInbox({
          selfAccountId: this.opts.selfAccountId,
          onRing: () => { /* caller doesn't consume its own rings */ },
        });
        await inbox.ring(this.opts.peerAccountId, {
          callId: this.currentCallId!,
          conversationId: this.opts.conversationId,
          callerAccountId: this.opts.selfAccountId,
          callerDisplayName: this.opts.selfDisplayName,
          media,
        });
        await inbox.close();
      } catch {
        /* inbox ring is best-effort · per-conversation ring already fired */
      }
    })();

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: media === "video",
    });
    await this.pc.setLocalDescription(offer);
    await this.signalling.sendOffer({
      callId: this.currentCallId,
      sdp: offer,
    });

    this.startRingTimer();
  }

  /** Inbound: accept an incoming call. Requests mic (and camera for
   *  video calls), negotiates. */
  async acceptIncoming(): Promise<void> {
    if (this.state !== "incoming") return;
    const offer = this.pendingOffer;
    const ring = this.pendingRing;
    if (!ring) return;

    this.role = "callee";
    this.currentCallId = ring.callId;
    this.currentMedia = ring.media;
    this.setState("connecting");
    this.pendingRing = null;
    this.pendingOffer = null;

    const constraints: MediaStreamConstraints = ring.media === "video"
      ? { audio: true, video: { facingMode: "user" } }
      : { audio: true, video: false };
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      this.opts.handlers.onError?.(
        ring.media === "video"
          ? "camera or microphone permission was denied"
          : "microphone permission was denied",
      );
      try { await this.signalling.sendBye({ callId: ring.callId, reason: "error" }); } catch { /* ignore */ }
      this.teardown("error");
      return;
    }
    this.opts.handlers.onLocalStream?.(this.localStream);

    this.pc = this.buildPeerConnection();
    for (const t of this.localStream.getTracks()) this.pc.addTrack(t, this.localStream);

    if (offer) {
      await this.pc.setRemoteDescription(offer.sdp);
      this.remoteDescriptionSet = true;
      await this.flushQueuedIce();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      await this.signalling.sendAnswer({
        callId: ring.callId,
        sdp: answer,
      });
    }
    // If the offer hasn't arrived yet, handleOffer() will run the answer
    // dance once it does — pc is already set up + local tracks added.
  }

  /** Inbound: decline an incoming call. */
  async declineIncoming(): Promise<void> {
    if (this.state !== "incoming") return;
    const callId = this.pendingRing?.callId ?? this.pendingOffer?.callId ?? null;
    if (callId) {
      try { await this.signalling.sendBye({ callId, reason: "declined" }); }
      catch { /* ignore */ }
    }
    this.teardown("declined");
  }

  /** Any state: hang up. */
  async hangup(): Promise<void> {
    if (this.state === "idle" || this.state === "ended") return;
    const callId = this.currentCallId;
    this.teardown("hangup");
    if (callId) {
      try { await this.signalling.sendBye({ callId, reason: "hangup" }); }
      catch { /* ignore */ }
    }
  }

  /** Toggle the local microphone. */
  setMuted(muted: boolean): void {
    if (!this.localStream) return;
    for (const t of this.localStream.getAudioTracks()) t.enabled = !muted;
  }

  /** Toggle the local camera (video calls only). No-op on voice calls. */
  setCameraOff(off: boolean): void {
    if (!this.localStream) return;
    for (const t of this.localStream.getVideoTracks()) t.enabled = !off;
  }

  /** Current media kind for this call. */
  getMedia(): PeerCallMedia {
    return this.currentMedia;
  }

  // ── Signalling handlers ────────────────────────────────────────────

  private handleRing(s: RingSignal): void {
    if (this.closed) return;
    if (s.callerAccountId === this.opts.selfAccountId) return;
    if (this.state !== "idle") {
      // Busy · politely decline so the caller stops ringing.
      void this.signalling.sendBye({ callId: s.callId, reason: "declined" });
      return;
    }
    this.pendingRing = {
      callId: s.callId,
      callerName: s.callerDisplayName || "someone",
      media: s.media,
    };
    this.setState("incoming");
    this.opts.handlers.onIncoming(this.pendingRing.callerName, s.media);
    // Ring timer on the callee side too — auto-decline after 45s so we
    // don't leave a phantom incoming UI up if the caller vanishes.
    this.startRingTimer();
  }

  private handleOffer(s: SdpOfferSignal): void {
    if (this.closed) return;
    if (this.state === "incoming") {
      // Store for acceptIncoming() to consume.
      this.pendingOffer = s;
      return;
    }
    if (this.state === "connecting" && this.role === "callee" && this.pc) {
      // Offer arrived AFTER user accepted · run the answer dance now.
      void (async () => {
        try {
          await this.pc!.setRemoteDescription(s.sdp);
          this.remoteDescriptionSet = true;
          await this.flushQueuedIce();
          const answer = await this.pc!.createAnswer();
          await this.pc!.setLocalDescription(answer);
          await this.signalling.sendAnswer({ callId: s.callId, sdp: answer });
        } catch (e) {
          this.opts.handlers.onError?.(`answer failed: ${(e as Error).message}`);
          this.teardown("error");
        }
      })();
    }
  }

  private handleAnswer(s: SdpAnswerSignal): void {
    if (this.role !== "caller" || !this.pc) return;
    if (s.callId !== this.currentCallId) return;
    void (async () => {
      try {
        await this.pc!.setRemoteDescription(s.sdp);
        this.remoteDescriptionSet = true;
        await this.flushQueuedIce();
        this.setState("connecting");
      } catch (e) {
        this.opts.handlers.onError?.(`answer accept failed: ${(e as Error).message}`);
        this.teardown("error");
      }
    })();
  }

  private async handleIce(s: IceSignal): Promise<void> {
    if (!this.pc) return;
    if (s.callId !== this.currentCallId && !this.pendingRing) return;
    if (!this.remoteDescriptionSet) {
      this.queuedIce.push(s.candidate);
      return;
    }
    try { await this.pc.addIceCandidate(s.candidate); }
    catch { /* stale candidate · ignore */ }
  }

  private handleBye(s: ByeSignal): void {
    const relevant =
      s.callId === this.currentCallId ||
      s.callId === this.pendingRing?.callId ||
      s.callId === this.pendingOffer?.callId;
    if (!relevant) return;
    const reason: PeerCallEndReason =
      s.reason === "declined" ? "peer-declined" : "peer-hangup";
    this.teardown(reason);
  }

  // ── Peer connection setup ──────────────────────────────────────────

  private buildPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) this.opts.handlers.onRemoteStream(stream);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && this.currentCallId) {
        void this.signalling.sendIce({
          callId: this.currentCallId,
          candidate: e.candidate.toJSON(),
        });
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected" && this.state !== "connected") {
        this.clearRingTimer();
        this.setState("connected");
      }
      if (s === "failed") {
        this.opts.handlers.onError?.("call connection failed");
        this.teardown("error");
      }
      if (s === "closed" && this.state !== "ended" && this.state !== "idle") {
        this.teardown("error");
      }
    };
    return pc;
  }

  private async flushQueuedIce(): Promise<void> {
    while (this.queuedIce.length > 0 && this.pc) {
      const c = this.queuedIce.shift()!;
      try { await this.pc.addIceCandidate(c); }
      catch { /* stale · ignore */ }
    }
  }

  private teardown(reason: PeerCallEndReason): void {
    this.clearRingTimer();
    try { this.pc?.close(); } catch { /* ignore */ }
    this.pc = null;
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) t.stop();
      this.localStream = null;
    }
    this.role = null;
    this.currentCallId = null;
    this.remoteDescriptionSet = false;
    this.queuedIce = [];
    this.pendingRing = null;
    this.pendingOffer = null;
    this.setState("ended");
    this.opts.handlers.onEnded(reason);
    this.idleTimer = setTimeout(() => {
      if (this.state === "ended") this.setState("idle");
    }, IDLE_AFTER_END_MS);
  }

  private setState(next: PeerCallState): void {
    if (this.state === next) return;
    this.state = next;
    this.opts.handlers.onStateChange(next);
  }

  private startRingTimer(): void {
    this.clearRingTimer();
    this.ringTimer = setTimeout(() => {
      if (this.state === "dialing" || this.state === "incoming") {
        const callId = this.currentCallId ?? this.pendingRing?.callId ?? null;
        this.teardown("unanswered");
        if (callId) {
          try { void this.signalling.sendBye({ callId, reason: "unanswered" }); }
          catch { /* ignore */ }
        }
      }
    }, RING_TIMEOUT_MS);
  }

  private clearRingTimer(): void {
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}

function generateCallId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for very old environments · Realtime already needs modern
  // browser features so this is essentially unreachable.
  return `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
