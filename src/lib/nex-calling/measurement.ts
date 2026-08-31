// src/lib/nex-calling/measurement.ts
//
// NEX Internal Calling · Stage 1 measurement client · Philip 2026-08-27.
//
// Collects browser-side RTC stats (RTCPeerConnection.getStats()) and posts
// them to the signalling server's /measure endpoint. The scripts/nex-calling/
// report-experiment.mjs then aggregates the JSONL log to prove or disprove
// the Stage 1 exit criterion:
//
//   "Can two NEX identities establish a real voice AND video call directly,
//    with zero paid calling API and essentially zero NEX bandwidth cost?"
//
// The single most important field this collects is `path`:
//   'p2p'         — media flowed direct peer-to-peer (Stage 1 success)
//   'srflx'       — media via server-reflexive candidate (still direct after STUN)
//   'relay'       — media relayed via TURN (would need TURN in production)
//
// If almost every call reports `path='p2p' or 'srflx'`, Stage 1 confirms that
// NEX signalling did the connection-setup work and then media bypassed NEX.

const SIGNAL_BASE = process.env.NEXT_PUBLIC_NEX_CALL_SIGNAL_URL
  ?? "http://localhost:8090";

export interface CallStats {
  callId:              string;
  identity:            string;
  peer:                string;
  role:                "caller" | "callee";
  path:                "p2p" | "srflx" | "relay" | "unknown";
  connectionState:     string;
  iceLocalType:        string | null;   // 'host' | 'srflx' | 'prflx' | 'relay'
  iceRemoteType:       string | null;
  bytesSent:           number;
  bytesReceived:       number;
  packetsLost:         number;
  jitterMs:            number | null;
  roundTripMs:         number | null;
  networkType:         string | null;   // 'wifi' | 'cellular' | 'ethernet' | ...
  audioCodec:          string | null;
  videoCodec:          string | null;
  videoResolution:     string | null;
  timestampMs:         number;
}

/** Extract signal-quality snapshot from a live RTCPeerConnection. */
export async function collectStats(pc: RTCPeerConnection, meta: {
  callId: string;
  identity: string;
  peer: string;
  role: "caller" | "callee";
}): Promise<CallStats> {
  const stats = await pc.getStats();
  let localCandidateType: string | null = null;
  let remoteCandidateType: string | null = null;
  let networkType: string | null = null;
  let bytesSent = 0;
  let bytesReceived = 0;
  let packetsLost = 0;
  let jitterMs: number | null = null;
  let roundTripMs: number | null = null;
  let audioCodec: string | null = null;
  let videoCodec: string | null = null;
  let videoResolution: string | null = null;

  // Find selected candidate pair via transport
  let selectedPairId: string | null = null;
  stats.forEach((r) => {
    if (r.type === "transport" && (r as { selectedCandidatePairId?: string }).selectedCandidatePairId) {
      selectedPairId = (r as { selectedCandidatePairId: string }).selectedCandidatePairId;
    }
  });

  stats.forEach((r) => {
    const rr = r as Record<string, unknown>;
    if (r.type === "candidate-pair" && (r.id === selectedPairId || rr.selected === true || rr.nominated === true)) {
      const local  = stats.get(rr.localCandidateId  as string);
      const remote = stats.get(rr.remoteCandidateId as string);
      if (local  && typeof local.candidateType  === "string") localCandidateType  = local.candidateType;
      if (remote && typeof remote.candidateType === "string") remoteCandidateType = remote.candidateType;
      if (local  && typeof local.networkType === "string")    networkType = local.networkType;
      if (typeof rr.currentRoundTripTime === "number") roundTripMs = Math.round(rr.currentRoundTripTime * 1000);
    }
    if (r.type === "outbound-rtp" && typeof rr.bytesSent === "number") {
      bytesSent += rr.bytesSent;
      if (rr.kind === "audio" && typeof rr.codecId === "string") {
        const codec = stats.get(rr.codecId as string);
        if (codec && typeof codec.mimeType === "string") audioCodec = codec.mimeType;
      }
      if (rr.kind === "video" && typeof rr.codecId === "string") {
        const codec = stats.get(rr.codecId as string);
        if (codec && typeof codec.mimeType === "string") videoCodec = codec.mimeType;
        if (typeof rr.frameWidth === "number" && typeof rr.frameHeight === "number") {
          videoResolution = `${rr.frameWidth}x${rr.frameHeight}`;
        }
      }
    }
    if (r.type === "inbound-rtp") {
      if (typeof rr.bytesReceived === "number") bytesReceived += rr.bytesReceived;
      if (typeof rr.packetsLost === "number")    packetsLost   += rr.packetsLost;
      if (typeof rr.jitter === "number" && jitterMs == null) jitterMs = Math.round(rr.jitter * 1000);
    }
  });

  // Classify the media path from the local candidate type.
  let path: CallStats["path"] = "unknown";
  if (localCandidateType === "relay" || remoteCandidateType === "relay") path = "relay";
  else if (localCandidateType === "host" && remoteCandidateType === "host") path = "p2p";
  else if (localCandidateType === "srflx" || remoteCandidateType === "srflx" || localCandidateType === "prflx" || remoteCandidateType === "prflx") path = "srflx";
  else if (localCandidateType === "host" || remoteCandidateType === "host") path = "p2p";

  return {
    callId: meta.callId,
    identity: meta.identity,
    peer: meta.peer,
    role: meta.role,
    path,
    connectionState: pc.connectionState,
    iceLocalType: localCandidateType,
    iceRemoteType: remoteCandidateType,
    bytesSent,
    bytesReceived,
    packetsLost,
    jitterMs,
    roundTripMs,
    networkType,
    audioCodec,
    videoCodec,
    videoResolution,
    timestampMs: Date.now(),
  };
}

/** POST a measurement snapshot to the signalling server. Fire-and-forget. */
export function reportStats(stats: CallStats): void {
  fetch(`${SIGNAL_BASE}/measure`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(stats),
    keepalive: true,
  }).catch(() => { /* dev-only · silent */ });
}
