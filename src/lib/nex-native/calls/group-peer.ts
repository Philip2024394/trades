// src/lib/nex-native/calls/group-peer.ts
//
// Pairwise WebRTC edge for the group-call mesh. Looks like a stripped
// PeerCall · the two differences that matter:
//
//  · Local MediaStream is INJECTED (not getUserMedia inside), so a
//    4-participant call does not prompt for the camera 3 times.
//  · Deterministic initiator rule — the lower account_id side offers,
//    the higher waits. Removes the need for a signalling "ring" verb
//    at this layer · membership is driven by group presence instead.
//
// Signalling runs on the same `nex:signal:{conversationId}` channel
// shape · we just synthesise a stable per-edge conversationId
// `grp:{sessionId}:{low}:{high}`.

"use client";

import {
  openSignallingChannel,
  type IceSignal,
  type SdpAnswerSignal,
  type SdpOfferSignal,
  type SignallingChannel,
} from "../realtime/signalling";

export type GroupPeerState =
  | "idle"
  | "connecting"
  | "connected"
  | "failed"
  | "closed";

export interface GroupPeerHandlers {
  onStateChange?: (state: GroupPeerState) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onError?: (msg: string) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

function pairwiseConversationId(
  sessionId: string,
  a: string,
  b: string,
): string {
  const [low, high] = [a, b].sort();
  return `grp:${sessionId}:${low}:${high}`;
}

export interface GroupPeerOptions {
  sessionId: string;
  selfAccountId: string;
  peerAccountId: string;
  mediaType: "audio" | "video";
  /** Local stream shared across the mesh · tracks are added to this
   *  edge's RTCPeerConnection but the stream itself is owned by the
   *  mesh engine. */
  localStream: MediaStream;
  handlers: GroupPeerHandlers;
}

export class GroupPeer {
  private readonly signalling: SignallingChannel;
  private readonly callId: string;
  private readonly weInitiate: boolean;
  private pc: RTCPeerConnection | null = null;
  private state: GroupPeerState = "idle";
  private remoteDescriptionSet = false;
  private queuedIce: RTCIceCandidateInit[] = [];
  private closed = false;

  constructor(private readonly opts: GroupPeerOptions) {
    // Lower account_id side is the initiator · deterministic across
    // both ends without needing a ring handshake.
    this.weInitiate = opts.selfAccountId < opts.peerAccountId;
    // Call-id is derived from the pair so late messages can be filtered
    // · ensures idempotency if both sides momentarily try to re-offer.
    this.callId = `${opts.sessionId}:${[opts.selfAccountId, opts.peerAccountId].sort().join(":")}`;

    this.signalling = openSignallingChannel({
      conversationId: pairwiseConversationId(
        opts.sessionId,
        opts.selfAccountId,
        opts.peerAccountId,
      ),
      selfAccountId: opts.selfAccountId,
      handlers: {
        onOffer:  (s) => this.handleOffer(s),
        onAnswer: (s) => this.handleAnswer(s),
        onIce:    (s) => void this.handleIce(s),
        onBye:    () => this.teardown("closed"),
        onError:  (e) => opts.handlers.onError?.(e),
      },
    });
  }

  getState(): GroupPeerState {
    return this.state;
  }

  getPeerAccountId(): string {
    return this.opts.peerAccountId;
  }

  /** Starts the pairwise negotiation if we're the initiator side.
   *  The non-initiator side just waits for the offer to arrive. */
  async start(): Promise<void> {
    if (this.closed) return;
    this.pc = this.buildPc();
    for (const t of this.opts.localStream.getTracks()) {
      this.pc.addTrack(t, this.opts.localStream);
    }
    this.setState("connecting");

    if (this.weInitiate) {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.opts.mediaType === "video",
      });
      await this.pc.setLocalDescription(offer);
      await this.signalling.sendOffer({ callId: this.callId, sdp: offer });
    }
    // Non-initiator: pc is primed with tracks, waits for offer in
    // handleOffer() which will set remote + reply with answer.
  }

  async close(): Promise<void> {
    this.closed = true;
    const live = this.state === "connecting" || this.state === "connected";
    if (live) {
      try { await this.signalling.sendBye({ callId: this.callId, reason: "hangup" }); }
      catch { /* ignore · closing anyway */ }
    }
    this.teardown("closed");
    await this.signalling.close();
  }

  private handleOffer(s: SdpOfferSignal): void {
    if (this.closed || this.weInitiate) return;
    if (s.callId !== this.callId) return;
    void (async () => {
      try {
        if (!this.pc) {
          this.pc = this.buildPc();
          for (const t of this.opts.localStream.getTracks()) {
            this.pc.addTrack(t, this.opts.localStream);
          }
          this.setState("connecting");
        }
        await this.pc.setRemoteDescription(s.sdp);
        this.remoteDescriptionSet = true;
        await this.flushQueuedIce();
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        await this.signalling.sendAnswer({ callId: this.callId, sdp: answer });
      } catch (e) {
        this.opts.handlers.onError?.(`group-peer offer failed: ${(e as Error).message}`);
        this.setState("failed");
      }
    })();
  }

  private handleAnswer(s: SdpAnswerSignal): void {
    if (!this.weInitiate || !this.pc) return;
    if (s.callId !== this.callId) return;
    void (async () => {
      try {
        await this.pc!.setRemoteDescription(s.sdp);
        this.remoteDescriptionSet = true;
        await this.flushQueuedIce();
      } catch (e) {
        this.opts.handlers.onError?.(`group-peer answer failed: ${(e as Error).message}`);
        this.setState("failed");
      }
    })();
  }

  private async handleIce(s: IceSignal): Promise<void> {
    if (!this.pc || s.callId !== this.callId) return;
    if (!this.remoteDescriptionSet) {
      this.queuedIce.push(s.candidate);
      return;
    }
    try { await this.pc.addIceCandidate(s.candidate); }
    catch { /* stale candidate · ignore */ }
  }

  private buildPc(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) this.opts.handlers.onRemoteStream?.(stream);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void this.signalling.sendIce({
          callId: this.callId,
          candidate: e.candidate.toJSON(),
        });
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected" && this.state !== "connected") {
        this.setState("connected");
      }
      if (s === "failed") {
        this.opts.handlers.onError?.("group-peer connection failed");
        this.setState("failed");
      }
      if (s === "closed" && this.state !== "closed") {
        this.setState("closed");
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

  private teardown(final: GroupPeerState): void {
    try { this.pc?.close(); } catch { /* ignore */ }
    this.pc = null;
    this.remoteDescriptionSet = false;
    this.queuedIce = [];
    this.setState(final);
  }

  private setState(next: GroupPeerState): void {
    if (this.state === next) return;
    this.state = next;
    this.opts.handlers.onStateChange?.(next);
  }
}
