// Nex Calls · client-side WebRTC peer + signaling · Philip 2026-08-03.
//
// Wraps RTCPeerConnection with just enough helper structure to run a
// 1-to-1 voice call end-to-end via the polling signaling backend. The
// caller creates an offer + POSTs it; the callee's inbox poll finds
// the offer, produces an answer + POSTs it; ICE candidates trickle
// both ways via the same POST. Google STUN only (TURN comes later).
//
// The peer helper is stateful — one instance per active call. Callers
// are responsible for creating and destroying it around a call.

import type { CallSignal, ContactSummary, SessionRef } from "./server";

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type CallRole = "caller" | "callee";
export type CallState =
  | "idle"
  | "connecting"   // ICE gathering + signaling in flight
  | "ringing"      // outgoing: offer sent, waiting for answer
  | "connected"
  | "ended";

export interface NexCallHandle {
  callId: string;
  role: CallRole;
  peer: RTCPeerConnection;
  localStream: MediaStream;
  remoteStream: MediaStream;
  state: () => CallState;
  hangUp: () => Promise<void>;
  toggleMute: () => boolean; // returns new muted state
  isMuted: () => boolean;
}

// ─── Signaling POST helper ─────────────────────────────────────────────

async function postSignal(signal: CallSignal): Promise<void> {
  try {
    await fetch("/api/nex/calls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "signal", signal }),
    });
  } catch {
    // Signalling is best-effort at this layer — the UI surfaces call
    // failure via peer.connectionState changes anyway.
  }
}

// ─── Inbox polling (module-level singleton) ────────────────────────────
//
// One poller per browser tab. Subscribers register a handler and get
// every signal addressed to their session. Started on first subscribe,
// stopped when the last unsubscribes.

type SignalHandler = (sig: CallSignal) => void;
const handlers = new Set<SignalHandler>();
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let currentSessionId: string | null = null;

async function pollOnce() {
  if (!currentSessionId) return;
  try {
    const res = await fetch(`/api/nex/calls?sessionId=${encodeURIComponent(currentSessionId)}`);
    const json = await res.json();
    if (json?.ok && Array.isArray(json.signals)) {
      for (const sig of json.signals as CallSignal[]) {
        for (const h of handlers) {
          try { h(sig); } catch { /* ignore individual handler errors */ }
        }
      }
    }
  } catch { /* transient network hiccup */ }
  pollTimer = setTimeout(pollOnce, 1000);
}

export function startCallSignalPolling(sessionId: string) {
  currentSessionId = sessionId;
  if (pollTimer) return;
  pollOnce();
}
export function stopCallSignalPolling() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  currentSessionId = null;
}
export function subscribeToCallSignals(handler: SignalHandler): () => void {
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}

// ─── Peer connection factory ──────────────────────────────────────────

function newCallId(): string {
  return "call-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function acquireMic(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
}

function buildPeer(
  callId: string,
  from: SessionRef,
  to: string,
  onRemoteTrack: (stream: MediaStream) => void,
  onState: (state: CallState) => void,
): RTCPeerConnection {
  const peer = new RTCPeerConnection({ iceServers: STUN_SERVERS });

  peer.onicecandidate = (ev) => {
    if (!ev.candidate) return;
    void postSignal({
      kind: "ice",
      callId,
      from,
      to,
      candidate: ev.candidate.toJSON(),
    });
  };

  peer.ontrack = (ev) => {
    // Aggregate remote tracks into a single MediaStream the UI attaches
    // to an <audio> element.
    if (ev.streams[0]) onRemoteTrack(ev.streams[0]);
  };

  peer.onconnectionstatechange = () => {
    const s = peer.connectionState;
    if (s === "connected") onState("connected");
    else if (s === "disconnected" || s === "closed" || s === "failed") onState("ended");
  };

  return peer;
}

// ─── Outgoing call ────────────────────────────────────────────────────

export async function startOutgoingCall(params: {
  fromSessionId: string;
  toSessionId: string;
  contact: ContactSummary;
  onState: (state: CallState) => void;
  onRemoteStream: (stream: MediaStream) => void;
}): Promise<NexCallHandle> {
  const callId = newCallId();
  const from: SessionRef = { sessionId: params.fromSessionId };
  const to = params.toSessionId;

  const localStream = await acquireMic();
  const remoteStream = new MediaStream();

  let state: CallState = "connecting";
  let muted = false;
  const setState = (s: CallState) => { state = s; params.onState(s); };

  const peer = buildPeer(callId, from, to, (s) => {
    for (const t of s.getTracks()) remoteStream.addTrack(t);
    params.onRemoteStream(remoteStream);
  }, setState);

  for (const t of localStream.getTracks()) peer.addTrack(t, localStream);

  const offer = await peer.createOffer({ offerToReceiveAudio: true });
  await peer.setLocalDescription(offer);

  setState("ringing");
  await postSignal({
    kind: "offer",
    callId,
    from,
    to,
    sdp: offer.sdp ?? "",
    contact: params.contact,
  });

  // Route inbound signals for THIS call.
  const unsubscribe = subscribeToCallSignals(async (sig) => {
    if (sig.callId !== callId) return;
    if (sig.kind === "answer") {
      try {
        await peer.setRemoteDescription({ type: "answer", sdp: sig.sdp });
      } catch { /* remote gone */ }
    } else if (sig.kind === "ice") {
      try {
        await peer.addIceCandidate(sig.candidate);
      } catch { /* candidate arrived after end */ }
    } else if (sig.kind === "hangup" || sig.kind === "decline") {
      setState("ended");
      cleanUp();
    }
  });

  function cleanUp() {
    for (const t of localStream.getTracks()) t.stop();
    peer.close();
    unsubscribe();
  }

  return {
    callId,
    role: "caller",
    peer,
    localStream,
    remoteStream,
    state: () => state,
    isMuted: () => muted,
    toggleMute: () => {
      muted = !muted;
      for (const t of localStream.getAudioTracks()) t.enabled = !muted;
      return muted;
    },
    hangUp: async () => {
      setState("ended");
      await postSignal({ kind: "hangup", callId, from, to });
      cleanUp();
    },
  };
}

// ─── Incoming call · accept ───────────────────────────────────────────

export async function acceptIncomingCall(params: {
  offer: Extract<CallSignal, { kind: "offer" }>;
  mySessionId: string;
  onState: (state: CallState) => void;
  onRemoteStream: (stream: MediaStream) => void;
  // Fresh ICE candidates that arrived AFTER we drained the offer but
  // BEFORE we finished creating the peer. Caller buffers them.
  bufferedCandidates?: RTCIceCandidateInit[];
}): Promise<NexCallHandle> {
  const { offer, mySessionId } = params;
  const callId = offer.callId;
  const from: SessionRef = { sessionId: mySessionId };
  const to = offer.from.sessionId;

  const localStream = await acquireMic();
  const remoteStream = new MediaStream();

  let state: CallState = "connecting";
  let muted = false;
  const setState = (s: CallState) => { state = s; params.onState(s); };

  const peer = buildPeer(callId, from, to, (s) => {
    for (const t of s.getTracks()) remoteStream.addTrack(t);
    params.onRemoteStream(remoteStream);
  }, setState);

  for (const t of localStream.getTracks()) peer.addTrack(t, localStream);

  await peer.setRemoteDescription({ type: "offer", sdp: offer.sdp });
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);

  await postSignal({
    kind: "answer",
    callId,
    from,
    to,
    sdp: answer.sdp ?? "",
  });

  // Apply any candidates that arrived while we were building the peer.
  if (params.bufferedCandidates) {
    for (const cand of params.bufferedCandidates) {
      try { await peer.addIceCandidate(cand); } catch { /* skip */ }
    }
  }

  const unsubscribe = subscribeToCallSignals(async (sig) => {
    if (sig.callId !== callId) return;
    if (sig.kind === "ice") {
      try { await peer.addIceCandidate(sig.candidate); } catch { /* skip */ }
    } else if (sig.kind === "hangup") {
      setState("ended");
      cleanUp();
    }
  });

  function cleanUp() {
    for (const t of localStream.getTracks()) t.stop();
    peer.close();
    unsubscribe();
  }

  return {
    callId,
    role: "callee",
    peer,
    localStream,
    remoteStream,
    state: () => state,
    isMuted: () => muted,
    toggleMute: () => {
      muted = !muted;
      for (const t of localStream.getAudioTracks()) t.enabled = !muted;
      return muted;
    },
    hangUp: async () => {
      setState("ended");
      await postSignal({ kind: "hangup", callId, from, to });
      cleanUp();
    },
  };
}

// ─── Decline an incoming call (never picked up) ───────────────────────

export async function declineIncomingCall(params: {
  offer: Extract<CallSignal, { kind: "offer" }>;
  mySessionId: string;
}): Promise<void> {
  await postSignal({
    kind: "decline",
    callId: params.offer.callId,
    from: { sessionId: params.mySessionId },
    to: params.offer.from.sessionId,
  });
}
