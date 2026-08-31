// src/lib/nex-calling/measurement.test.ts
//
// NEX Calling · Path classifier regression tests · Philip 2026-08-27.
//
// The path classifier (p2p / srflx / relay) is the load-bearing metric for
// Stage 1's exit criterion "media bypasses NEX". These tests lock the
// classification rules so a code change can't silently break the evidence.

import { describe, it, expect } from "vitest";
import { collectStats } from "./measurement";

// Minimal RTCPeerConnection shim that returns a curated stats map. We build
// each fixture to exercise a specific classification path.

function fakePc(stats: Map<string, any>, connectionState = "connected"): any {
  return {
    connectionState,
    getStats: async () => stats,
  };
}

function buildStats({ local, remote, sent = 100, received = 100 }: {
  local: string; remote: string; sent?: number; received?: number;
}) {
  const m = new Map<string, any>();
  m.set("T1", { type: "transport", selectedCandidatePairId: "P1" });
  m.set("P1", {
    id: "P1", type: "candidate-pair", selected: true, nominated: true,
    localCandidateId: "L1", remoteCandidateId: "R1",
    currentRoundTripTime: 0.05,
  });
  m.set("L1", { type: "local-candidate", candidateType: local, networkType: "wifi" });
  m.set("R1", { type: "remote-candidate", candidateType: remote });
  m.set("out-a", { type: "outbound-rtp", kind: "audio", bytesSent: sent, codecId: "codec-a" });
  m.set("codec-a", { type: "codec", mimeType: "audio/opus" });
  m.set("out-v", { type: "outbound-rtp", kind: "video", bytesSent: sent, codecId: "codec-v", frameWidth: 640, frameHeight: 360 });
  m.set("codec-v", { type: "codec", mimeType: "video/VP8" });
  m.set("in-a", { type: "inbound-rtp", kind: "audio", bytesReceived: received, packetsLost: 0, jitter: 0.005 });
  m.set("in-v", { type: "inbound-rtp", kind: "video", bytesReceived: received, packetsLost: 0 });
  // getStats().forEach must iterate values only (spec).
  const spec = {
    forEach: (fn: any) => { for (const v of m.values()) fn(v); },
    get: (k: string) => m.get(k),
  };
  return spec as any;
}

const META = { callId: "test-call", identity: "alice", peer: "bob", role: "caller" as const };

describe("nex-calling · path classifier", () => {
  it("host + host = p2p (Stage 1 success case)", async () => {
    const pc = fakePc(buildStats({ local: "host", remote: "host" }));
    const s = await collectStats(pc, META);
    expect(s.path).toBe("p2p");
    expect(s.iceLocalType).toBe("host");
    expect(s.iceRemoteType).toBe("host");
  });

  it("srflx + srflx = srflx (still direct after STUN)", async () => {
    const pc = fakePc(buildStats({ local: "srflx", remote: "srflx" }));
    const s = await collectStats(pc, META);
    expect(s.path).toBe("srflx");
  });

  it("host + srflx = srflx", async () => {
    const pc = fakePc(buildStats({ local: "host", remote: "srflx" }));
    const s = await collectStats(pc, META);
    expect(s.path).toBe("srflx");
  });

  it("either side = relay marks the whole call relay", async () => {
    const pc = fakePc(buildStats({ local: "host", remote: "relay" }));
    const s = await collectStats(pc, META);
    expect(s.path).toBe("relay");
  });

  it("both sides = relay marks the whole call relay", async () => {
    const pc = fakePc(buildStats({ local: "relay", remote: "relay" }));
    const s = await collectStats(pc, META);
    expect(s.path).toBe("relay");
  });

  it("prflx = srflx classification (peer-reflexive counts as reflexive)", async () => {
    const pc = fakePc(buildStats({ local: "prflx", remote: "host" }));
    const s = await collectStats(pc, META);
    expect(s.path).toBe("srflx");
  });

  it("emits RTT + codec + resolution", async () => {
    const pc = fakePc(buildStats({ local: "host", remote: "host" }));
    const s = await collectStats(pc, META);
    expect(s.roundTripMs).toBe(50);
    expect(s.audioCodec).toBe("audio/opus");
    expect(s.videoCodec).toBe("video/VP8");
    expect(s.videoResolution).toBe("640x360");
  });
});
