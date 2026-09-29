// src/lib/nex-native/realtime/signalling.ts
//
// Bridge 67 · Typed WebRTC signalling channel.
//
// Sits on top of the generic channel wrapper. Every peer-to-peer call
// (voice or video) uses one signalling channel scoped to the peer
// conversation id (`nex:signal:{conversationId}`).
//
// Signal kinds:
//   · ring        — caller announces "I'm calling you" · triggers UI
//   · sdp-offer   — caller's SDP offer (audio or audio+video)
//   · sdp-answer  — callee's SDP answer
//   · ice         — either side's ICE candidate
//   · bye         — either side ends the call (or callee rejects)
//
// The channel does NOT hold call state — that lives in the UI layer
// which owns the RTCPeerConnection. This module only ferries typed
// messages between the two participants.

"use client";

import { openNexChannel, type NexChannelHandle } from "./channel";

export type CallMedia = "audio" | "video";
export type ByeReason = "hangup" | "declined" | "unanswered" | "error";

export interface RingSignal {
  kind: "ring";
  callId: string;
  media: CallMedia;
  callerAccountId: string;
  callerDisplayName: string;
}

export interface SdpOfferSignal {
  kind: "sdp-offer";
  callId: string;
  sdp: RTCSessionDescriptionInit;
  iceRestart?: boolean;
}

export interface SdpAnswerSignal {
  kind: "sdp-answer";
  callId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface IceSignal {
  kind: "ice";
  callId: string;
  candidate: RTCIceCandidateInit;
}

export interface ByeSignal {
  kind: "bye";
  callId: string;
  reason: ByeReason;
}

export type CallSignal =
  | RingSignal
  | SdpOfferSignal
  | SdpAnswerSignal
  | IceSignal
  | ByeSignal;

export interface SignallingHandlers {
  onRing?: (s: RingSignal) => void;
  onOffer?: (s: SdpOfferSignal) => void;
  onAnswer?: (s: SdpAnswerSignal) => void;
  onIce?: (s: IceSignal) => void;
  onBye?: (s: ByeSignal) => void;
  onSubscribed?: () => void;
  onError?: (err: string) => void;
}

export interface SignallingChannel {
  sendRing(s: Omit<RingSignal, "kind">): Promise<void>;
  sendOffer(s: Omit<SdpOfferSignal, "kind">): Promise<void>;
  sendAnswer(s: Omit<SdpAnswerSignal, "kind">): Promise<void>;
  sendIce(s: Omit<IceSignal, "kind">): Promise<void>;
  sendBye(s: Omit<ByeSignal, "kind">): Promise<void>;
  close(): Promise<void>;
}

function channelNameFor(conversationId: string): string {
  return `nex:signal:${conversationId}`;
}

/**
 * Open a signalling channel for a conversation. Handlers fire for
 * peer-originated signals only (self-echoes are filtered by the
 * underlying channel wrapper).
 */
export function openSignallingChannel(opts: {
  conversationId: string;
  selfAccountId: string;
  handlers: SignallingHandlers;
}): SignallingChannel {
  const h = opts.handlers;
  const handle: NexChannelHandle = openNexChannel({
    name: channelNameFor(opts.conversationId),
    selfId: opts.selfAccountId,
    onSubscribed: h.onSubscribed,
    onError: h.onError,
    onBroadcast: (event, envelope) => {
      const s = envelope.payload as CallSignal;
      if (!s || typeof s !== "object" || s.kind !== event) return;
      switch (s.kind) {
        case "ring":       h.onRing?.(s);   return;
        case "sdp-offer":  h.onOffer?.(s);  return;
        case "sdp-answer": h.onAnswer?.(s); return;
        case "ice":        h.onIce?.(s);    return;
        case "bye":        h.onBye?.(s);    return;
      }
    },
  });

  const send = async (event: CallSignal["kind"], body: CallSignal) => {
    await handle.broadcast(event, body as unknown as Record<string, unknown>);
  };

  return {
    sendRing:   (s) => send("ring",       { kind: "ring", ...s }),
    sendOffer:  (s) => send("sdp-offer",  { kind: "sdp-offer", ...s }),
    sendAnswer: (s) => send("sdp-answer", { kind: "sdp-answer", ...s }),
    sendIce:    (s) => send("ice",        { kind: "ice", ...s }),
    sendBye:    (s) => send("bye",        { kind: "bye", ...s }),
    close: () => handle.close(),
  };
}
