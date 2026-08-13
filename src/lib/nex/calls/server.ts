// Nex Calls · signaling store · Philip 2026-08-03.
//
// In-memory relay for WebRTC signaling messages between two peers.
// Polling-based delivery — the receiver's client fetches its inbox
// every ~1s, drains messages, and processes them. Simpler than
// WebSockets for a v1 demo in Next.js app router; migrate to a real
// long-lived transport (WebSocket / SSE / hosted service) with the
// backend rewrite.
//
// Storage is process memory only:
//   · Restart wipes in-flight signaling (safe · calls that were
//     already connected are peer-to-peer and unaffected).
//   · Multi-instance deploys need a shared store (Redis/pub-sub).

export type CallSignal =
  | { kind: "offer";        callId: string; from: SessionRef; to: string; sdp: string; contact?: ContactSummary }
  | { kind: "answer";       callId: string; from: SessionRef; to: string; sdp: string }
  | { kind: "ice";          callId: string; from: SessionRef; to: string; candidate: RTCIceCandidateInit }
  | { kind: "hangup";       callId: string; from: SessionRef; to: string }
  | { kind: "decline";      callId: string; from: SessionRef; to: string };

// Sender identity attached to every signal — the callee's UI uses this
// to render the incoming-call name + avatar without a separate lookup.
export type SessionRef = {
  sessionId: string;
};

// Light contact snapshot the caller ships with an offer so the callee's
// incoming-call overlay can render name/initials/avatar immediately.
export type ContactSummary = {
  id: string;
  name: string;
  initials: string;
  avatarColor?: string;
  avatarUrl?: string;
  trade?: string;
  city?: string;
};

// sessionId → pending inbox messages. Drained on GET.
const inbox = new Map<string, CallSignal[]>();

export function deliverSignal(sig: CallSignal): void {
  const existing = inbox.get(sig.to) ?? [];
  // Coalesce a run of ICE candidates so an idle receiver doesn't get
  // an unbounded backlog.
  existing.push(sig);
  inbox.set(sig.to, existing);
}

export function drainInbox(sessionId: string): CallSignal[] {
  const msgs = inbox.get(sessionId) ?? [];
  if (msgs.length > 0) inbox.set(sessionId, []);
  return msgs;
}

export function debugState() {
  const summary: Record<string, number> = {};
  for (const [k, v] of inbox.entries()) summary[k] = v.length;
  return { inbox: summary };
}
