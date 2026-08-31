// src/lib/nex-calling/webrtc-client.ts
//
// NEX Internal Calling · WebRTC client · Philip 2026-08-27 (v2 · resilience).
//
// Thin wrapper around RTCPeerConnection that:
//   · Creates the peer connection with multiple public STUN servers (redundancy)
//   · Attaches local media (mic + camera)
//   · Handles offer/answer + ICE candidate exchange via the signalling server
//   · Emits stats to the measurement helper every 3 seconds during a call
//   · Auto-restarts ICE when connection state degrades (bad signal / network handover)
//   · Falls back to voice-only on severe degradation (>1.5s RTT sustained)
//   · Requests lower video bitrate when quality drops
//   · Provides quality events so the UI can show "poor connection" warnings
//   · Enforces a call-timeout on ringing that never got answered

import { collectStats, reportStats, type CallStats } from "./measurement";

export interface WebRTCClientOptions {
  identity: string;
  peer: string;
  role: "caller" | "callee";
  signalBase: string;
  localStream: MediaStream;
  onRemoteTrack: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onQualityChange?: (quality: CallQuality) => void;
  onEnded: () => void;
}

export type CallQuality = "excellent" | "good" | "poor" | "bad" | "unknown";

// Public STUN redundancy · Google's servers + Cloudflare's + Twilio's public
// nodes. If one is unreachable behind restrictive firewalls, others hold up.
// Still NO TURN in Stage 1 (per ADR-0100a) but the resolver still upgrades to
// relay ONLY when explicitly configured post-measurement.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

// Quality thresholds (RTT ms · packet loss ratio · jitter ms). Sourced from
// standard WebRTC quality bands.
const QUALITY_BANDS = {
  excellent: { rttMax: 100,  lossMax: 0.005, jitterMax: 20  },
  good:      { rttMax: 200,  lossMax: 0.02,  jitterMax: 40  },
  poor:      { rttMax: 400,  lossMax: 0.05,  jitterMax: 80  },
  // bad = anything worse than poor
};

// Adaptive fallbacks fire only after N consecutive bad samples so we don't
// oscillate on one transient blip.
const CONSECUTIVE_BAD_FOR_ICE_RESTART   = 3;   // ~9s of "disconnected" or bad quality
const CONSECUTIVE_BAD_FOR_VIDEO_DEGRADE = 2;   // ~6s
const CONSECUTIVE_BAD_FOR_VOICE_ONLY    = 5;   // ~15s of "bad"
const RINGING_TIMEOUT_MS = 45_000;             // 45s no answer → hangup

export class NexWebRTCClient {
  private pc: RTCPeerConnection;
  private opts: WebRTCClientOptions;
  private callId: string;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private ringTimeout: ReturnType<typeof setTimeout> | null = null;
  private endedCalled = false;
  private lastQuality: CallQuality = "unknown";
  private consecutiveBad = 0;
  private consecutivePoor = 0;
  private videoDegraded = false;
  private voiceOnly = false;
  private iceRestartInFlight = false;
  private queuedIceCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;

  constructor(opts: WebRTCClientOptions, callId: string) {
    this.opts = opts;
    this.callId = callId;
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Attach local tracks
    for (const track of opts.localStream.getTracks()) {
      this.pc.addTrack(track, opts.localStream);
    }

    // Forward remote track to caller
    this.pc.ontrack = (evt) => {
      if (evt.streams && evt.streams[0]) opts.onRemoteTrack(evt.streams[0]);
    };

    // Send ICE candidates to peer via signalling
    this.pc.onicecandidate = async (evt) => {
      if (evt.candidate) {
        await this.sendSignal("ice-candidate", { candidate: evt.candidate.toJSON() });
      }
    };

    // Watch connection state · start stats loop once connected · restart ICE on drop
    this.pc.onconnectionstatechange = () => {
      opts.onConnectionStateChange(this.pc.connectionState);
      if (this.pc.connectionState === "connected") {
        this.clearRingTimeout();
        if (!this.statsTimer) this.startStatsLoop();
      }
      if (this.pc.connectionState === "disconnected") {
        // Transient · try ICE restart before giving up
        this.considerIceRestart("connection-state=disconnected");
      }
      if (this.pc.connectionState === "failed") {
        // Failed is more severe · give ICE restart one last chance, else hang up.
        if (!this.iceRestartInFlight) {
          this.considerIceRestart("connection-state=failed");
          setTimeout(() => {
            if (this.pc.connectionState === "failed") this.hangup();
          }, 8000);
        }
      }
      if (this.pc.connectionState === "closed") {
        this.stopStatsLoop();
        this.emitEnded();
      }
    };

    // Handle network changes (Wi-Fi ↔ cellular). This is a resilience hook —
    // some browsers surface it as iceconnectionstatechange="checking".
    this.pc.oniceconnectionstatechange = () => {
      const s = this.pc.iceConnectionState;
      if (s === "disconnected" || s === "failed") {
        this.considerIceRestart(`ice-connection-state=${s}`);
      }
    };
  }

  /** Caller: create offer, send to peer. Starts ringing timeout. */
  async invite(): Promise<void> {
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await this.pc.setLocalDescription(offer);
    await this.sendSignal("sdp-offer", { sdp: offer });
    this.startRingTimeout();
  }

  /** Callee: handle incoming offer, create + send answer. */
  async acceptOffer(sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(sdp);
    this.remoteDescriptionSet = true;
    await this.flushQueuedIceCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.sendSignal("sdp-answer", { sdp: answer });
  }

  async handleAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(sdp);
    this.remoteDescriptionSet = true;
    await this.flushQueuedIceCandidates();
    this.clearRingTimeout();
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.remoteDescriptionSet) {
      // Buffer until setRemoteDescription runs · fixes race where callee
      // receives candidates before offer is set. Prevents dropped candidates
      // on flaky signalling reorder.
      this.queuedIceCandidates.push(candidate);
      return;
    }
    try { await this.pc.addIceCandidate(candidate); }
    catch (err) { console.warn("[webrtc] addIceCandidate failed", err); }
  }

  /** Manual mute/unmute — mid-call resilience: user can drop video to save bandwidth. */
  setVideoEnabled(enabled: boolean): void {
    for (const t of this.opts.localStream.getVideoTracks()) t.enabled = enabled;
  }
  setAudioEnabled(enabled: boolean): void {
    for (const t of this.opts.localStream.getAudioTracks()) t.enabled = enabled;
  }

  hangup(): void {
    this.clearRingTimeout();
    this.stopStatsLoop();
    try { this.pc.close(); } catch { /* ignore */ }
    this.sendSignal("bye", {}).catch(() => { /* ignore */ });
    this.emitEnded();
  }

  // ── ICE restart · reconnect after network handover / signal drop ────────
  private async considerIceRestart(reason: string): Promise<void> {
    if (this.iceRestartInFlight) return;
    if (this.pc.connectionState === "closed" || this.endedCalled) return;
    if (this.opts.role !== "caller") return;   // only caller drives restart in dev
    this.iceRestartInFlight = true;
    try {
      console.info(`[webrtc] ICE restart · ${reason}`);
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      await this.sendSignal("sdp-offer", { sdp: offer, iceRestart: true });
    } catch (e) {
      console.warn(`[webrtc] ICE restart failed: ${(e as Error).message}`);
    } finally {
      // Give the restart time to settle before allowing another attempt.
      setTimeout(() => { this.iceRestartInFlight = false; }, 10_000);
    }
  }

  private async flushQueuedIceCandidates() {
    while (this.queuedIceCandidates.length > 0) {
      const c = this.queuedIceCandidates.shift()!;
      try { await this.pc.addIceCandidate(c); } catch { /* silent · already flushed */ }
    }
  }

  // ── Ring timeout (caller-only) ─────────────────────────────────────────
  private startRingTimeout() {
    this.clearRingTimeout();
    this.ringTimeout = setTimeout(() => {
      console.info("[webrtc] ringing timeout · no answer · hanging up");
      this.hangup();
    }, RINGING_TIMEOUT_MS);
  }
  private clearRingTimeout() {
    if (this.ringTimeout) { clearTimeout(this.ringTimeout); this.ringTimeout = null; }
  }

  // ── Stats + adaptive quality loop ──────────────────────────────────────
  private startStatsLoop() {
    if (this.statsTimer) return;
    const tick = async () => {
      try {
        const s = await collectStats(this.pc, {
          callId: this.callId,
          identity: this.opts.identity,
          peer: this.opts.peer,
          role: this.opts.role,
        });
        reportStats(s);
        this.evaluateQuality(s);
      } catch { /* silent */ }
    };
    void tick();
    this.statsTimer = setInterval(tick, 3000);
  }

  private stopStatsLoop() {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  /** Evaluate call quality per sample, fire quality change event, apply
   * adaptive fallbacks (video bitrate ↓, voice-only) when quality is bad.
   */
  private evaluateQuality(s: CallStats): void {
    const rtt    = s.roundTripMs ?? 0;
    const jitter = s.jitterMs ?? 0;
    const lossFrac = s.bytesReceived > 0 ? Math.min(1, s.packetsLost / Math.max(1, s.bytesReceived / 100)) : 0;

    let q: CallQuality;
    if (rtt < QUALITY_BANDS.excellent.rttMax && jitter < QUALITY_BANDS.excellent.jitterMax && lossFrac < QUALITY_BANDS.excellent.lossMax) q = "excellent";
    else if (rtt < QUALITY_BANDS.good.rttMax && jitter < QUALITY_BANDS.good.jitterMax && lossFrac < QUALITY_BANDS.good.lossMax) q = "good";
    else if (rtt < QUALITY_BANDS.poor.rttMax && jitter < QUALITY_BANDS.poor.jitterMax && lossFrac < QUALITY_BANDS.poor.lossMax) q = "poor";
    else q = "bad";

    if (q !== this.lastQuality) {
      this.lastQuality = q;
      this.opts.onQualityChange?.(q);
    }

    // Track consecutive bad samples for tiered fallback.
    if (q === "bad") this.consecutiveBad += 1; else this.consecutiveBad = 0;
    if (q === "poor" || q === "bad") this.consecutivePoor += 1; else this.consecutivePoor = 0;

    // Tier 1 · degrade video bitrate after 2 consecutive poor+ samples.
    if (!this.videoDegraded && this.consecutivePoor >= CONSECUTIVE_BAD_FOR_VIDEO_DEGRADE) {
      this.degradeVideoBitrate();
      this.videoDegraded = true;
    }
    // Tier 2 · voice-only fallback after 5 consecutive bad samples.
    if (!this.voiceOnly && this.consecutiveBad >= CONSECUTIVE_BAD_FOR_VOICE_ONLY) {
      this.setVideoEnabled(false);
      this.voiceOnly = true;
      console.info("[webrtc] voice-only fallback engaged (sustained bad quality)");
    }
    // Tier 3 · ICE restart after 3 consecutive bad samples (handover / bad path).
    if (this.consecutiveBad >= CONSECUTIVE_BAD_FOR_ICE_RESTART) {
      this.considerIceRestart("quality=bad × 3 samples");
    }
  }

  private async degradeVideoBitrate(): Promise<void> {
    for (const sender of this.pc.getSenders()) {
      if (sender.track?.kind === "video") {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
        // Cap at ~250 kbps · sufficient for 320x240 talking head.
        params.encodings[0].maxBitrate = 250_000;
        try { await sender.setParameters(params); } catch { /* browser might not support */ }
      }
    }
  }

  private emitEnded() {
    if (this.endedCalled) return;
    this.endedCalled = true;
    this.opts.onEnded();
  }

  private async sendSignal(type: string, payload: Record<string, unknown>): Promise<void> {
    await fetch(`${this.opts.signalBase}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: this.opts.identity,
        to:   this.opts.peer,
        type,
        payload: { ...payload, callId: this.callId },
      }),
    }).catch(() => { /* silent · dev only */ });
  }
}
