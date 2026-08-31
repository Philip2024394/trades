"use client";

// src/app/nex-calling/experiment/page.tsx
//
// NEX Internal Calling · Stage 1 experiment page · Philip 2026-08-27.
//
// TWO BROWSER WINDOWS · One picks "I'm Alice" · other picks "I'm Bob".
// Once both are online, Alice can call Bob (or vice versa).
// WebRTC direct P2P · public STUN only · no TURN · no paid API.
//
// Stage 1 exit criterion (in-browser):
//   - Both see audio + video
//   - Hang up cleanly
//   - Status panel shows "path: p2p" or "path: srflx" (not "relay")

import { useCallback, useEffect, useRef, useState } from "react";
import { NexWebRTCClient } from "@/lib/nex-calling/webrtc-client";
import { collectStats, type CallStats } from "@/lib/nex-calling/measurement";

const SIGNAL_BASE = process.env.NEXT_PUBLIC_NEX_CALL_SIGNAL_URL ?? "http://localhost:8090";

const DEV_IDENTITIES = [
  { id: "alice-dev-uuid", label: "I'm Alice", color: "#f97316" },
  { id: "bob-dev-uuid",   label: "I'm Bob",   color: "#0891b2" },
];

type Phase = "choose-identity" | "idle" | "outgoing" | "incoming" | "in-call" | "ended";

interface IncomingCall { from: string; callId: string; sdp: RTCSessionDescriptionInit }

export default function CallingExperiment() {
  const [identity, setIdentity] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("choose-identity");
  const [online, setOnline] = useState<string[]>([]);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [currentPeer, setCurrentPeer] = useState<string | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>("new");
  const [latestStats, setLatestStats] = useState<CallStats | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const clientRef = useRef<NexWebRTCClient | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const startedAtRef = useRef<Date | null>(null);
  const connectedAtRef = useRef<Date | null>(null);
  const latestStatsRef = useRef<CallStats | null>(null);
  const recordedRef = useRef<Set<string>>(new Set());   // prevent double-write per call
  const callRoleRef = useRef<"caller" | "callee">("caller");

  const appendLog = useCallback((line: string) => {
    setLog((l) => [`${new Date().toLocaleTimeString()} · ${line}`, ...l].slice(0, 40));
  }, []);

  // Post a call_record row on hangup. Both peers write their perspective
  // (direction=outbound for caller, inbound for callee) so HQ shows both
  // sides of the same call.
  const postCallRecord = useCallback(async (callId: string, peerId: string) => {
    if (!identity) return;
    if (recordedRef.current.has(callId)) return;   // dedup
    recordedRef.current.add(callId);
    const startedAt = startedAtRef.current ?? new Date();
    const connectedAt = connectedAtRef.current;
    const endedAt = new Date();
    const durationSec = connectedAt
      ? Math.round((endedAt.getTime() - connectedAt.getTime()) / 1000)
      : 0;
    const s = latestStatsRef.current;
    const role = callRoleRef.current;
    const body = {
      caller_user_id: role === "caller" ? identity : peerId,
      callee_user_id: role === "caller" ? peerId : identity,
      caller_display_name: role === "caller" ? identity : peerId,
      callee_display_name: role === "caller" ? peerId : identity,
      media_type: "video" as const,
      direction: (role === "caller" ? "outbound" : "inbound") as "outbound" | "inbound",
      started_at: startedAt.toISOString(),
      connected_at: connectedAt?.toISOString() ?? null,
      ended_at: endedAt.toISOString(),
      duration_sec: durationSec,
      end_reason: connectedAt ? "completed" : "missed" as const,
      path: s?.path ?? "unknown",
      quality_median_rtt_ms: s?.roundTripMs ?? null,
      quality_median_jitter_ms: s?.jitterMs ?? null,
      quality_packets_lost: s?.packetsLost ?? null,
      bytes_sent: s?.bytesSent ?? null,
      bytes_received: s?.bytesReceived ?? null,
      audio_codec: s?.audioCodec ?? null,
      video_codec: s?.videoCodec ?? null,
      video_resolution: s?.videoResolution ?? null,
      client_call_id: callId,
    };
    try {
      const r = await fetch("/api/nex-calling/call-record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) appendLog(`call recorded · id=${(j.id ?? "").slice(0, 8)} · duration=${durationSec}s`);
      else appendLog(`call-record failed · ${j.error ?? r.status}`);
    } catch (e) {
      appendLog(`call-record error · ${(e as Error).message}`);
    }
  }, [identity, appendLog]);

  // ── Identity selection + SSE connection ──
  const pickIdentity = async (id: string) => {
    setIdentity(id);
    // Announce hello
    await fetch(`${SIGNAL_BASE}/hello`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity: id }),
    }).catch(() => { appendLog("hello failed · is the signalling server running?"); });

    // Open SSE stream
    const es = new EventSource(`${SIGNAL_BASE}/stream/${encodeURIComponent(id)}`);
    eventSourceRef.current = es;
    es.onmessage = async (evt) => {
      let msg: { type: string; from?: string; payload?: Record<string, unknown>; online?: string[] };
      try { msg = JSON.parse(evt.data); } catch { return; }
      if (msg.type === "presence") {
        setOnline(msg.online ?? []);
        return;
      }
      const payload = (msg.payload ?? {}) as Record<string, unknown>;
      const callId  = typeof payload.callId === "string" ? payload.callId : "";
      const fromId  = msg.from ?? "unknown";

      if (msg.type === "sdp-offer" && payload.sdp) {
        appendLog(`incoming call from ${fromId}`);
        setIncoming({ from: fromId, callId, sdp: payload.sdp as RTCSessionDescriptionInit });
        setPhase("incoming");
      } else if (msg.type === "sdp-answer" && payload.sdp && clientRef.current) {
        appendLog(`answer received from ${fromId}`);
        await clientRef.current.handleAnswer(payload.sdp as RTCSessionDescriptionInit);
      } else if (msg.type === "ice-candidate" && payload.candidate && clientRef.current) {
        await clientRef.current.addIceCandidate(payload.candidate as RTCIceCandidateInit);
      } else if (msg.type === "bye") {
        appendLog(`${fromId} ended the call`);
        clientRef.current?.hangup();
      }
    };
    es.onerror = () => appendLog("SSE stream error · reconnecting…");
    setPhase("idle");
  };

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      clientRef.current?.hangup();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Local media (mic + camera) ──
  const ensureLocalMedia = async (): Promise<MediaStream> => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => { /* autoplay may block · fine */ });
    }
    return stream;
  };

  // ── Initiate call ──
  const startCall = async (peerId: string) => {
    if (!identity) return;
    const localStream = await ensureLocalMedia();
    const callId = crypto.randomUUID();
    startedAtRef.current = new Date();
    connectedAtRef.current = null;
    latestStatsRef.current = null;
    callRoleRef.current = "caller";
    const client = new NexWebRTCClient({
      identity, peer: peerId, role: "caller",
      signalBase: SIGNAL_BASE,
      localStream,
      onRemoteTrack: (remote) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
          remoteVideoRef.current.play().catch(() => { /* ignore */ });
        }
      },
      onConnectionStateChange: (s) => {
        setConnectionState(s);
        appendLog(`connectionState: ${s}`);
        if (s === "connected") {
          setPhase("in-call");
          if (!connectedAtRef.current) connectedAtRef.current = new Date();
        }
        // Update stats when connection changes
        if (s === "connected" && clientRef.current) {
          const pc = (clientRef.current as unknown as { pc: RTCPeerConnection }).pc;
          void collectStats(pc, { callId, identity, peer: peerId, role: "caller" }).then((st) => {
            setLatestStats(st); latestStatsRef.current = st;
          });
        }
      },
      onEnded: () => {
        setPhase("ended");
        appendLog("call ended");
        void postCallRecord(callId, peerId);
      },
    }, callId);
    clientRef.current = client;
    setCurrentPeer(peerId);
    setCurrentCallId(callId);
    appendLog(`calling ${peerId}…`);
    setPhase("outgoing");
    await client.invite();
  };

  // ── Answer incoming call ──
  const acceptIncoming = async () => {
    if (!identity || !incoming) return;
    const localStream = await ensureLocalMedia();
    startedAtRef.current = new Date();
    connectedAtRef.current = null;
    latestStatsRef.current = null;
    callRoleRef.current = "callee";
    const client = new NexWebRTCClient({
      identity, peer: incoming.from, role: "callee",
      signalBase: SIGNAL_BASE,
      localStream,
      onRemoteTrack: (remote) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
          remoteVideoRef.current.play().catch(() => { /* ignore */ });
        }
      },
      onConnectionStateChange: (s) => {
        setConnectionState(s);
        appendLog(`connectionState: ${s}`);
        if (s === "connected") {
          setPhase("in-call");
          if (!connectedAtRef.current) connectedAtRef.current = new Date();
          if (clientRef.current && identity && incoming) {
            const pc = (clientRef.current as unknown as { pc: RTCPeerConnection }).pc;
            void collectStats(pc, { callId: incoming.callId, identity, peer: incoming.from, role: "callee" }).then((st) => {
              setLatestStats(st); latestStatsRef.current = st;
            });
          }
        }
      },
      onEnded: () => {
        setPhase("ended");
        appendLog("call ended");
        const peerAtEnd = incoming?.from ?? "unknown";
        const callIdAtEnd = incoming?.callId ?? "unknown";
        void postCallRecord(callIdAtEnd, peerAtEnd);
      },
    }, incoming.callId);
    clientRef.current = client;
    setCurrentPeer(incoming.from);
    setCurrentCallId(incoming.callId);
    appendLog(`accepting call from ${incoming.from}`);
    await client.acceptOffer(incoming.sdp);
    setIncoming(null);
  };

  const declineIncoming = () => {
    if (incoming && identity) {
      void fetch(`${SIGNAL_BASE}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: identity, to: incoming.from, type: "bye", payload: { callId: incoming.callId } }),
      });
    }
    setIncoming(null);
    setPhase("idle");
  };

  const hangup = () => {
    clientRef.current?.hangup();
    clientRef.current = null;
    setPhase("idle");
    setCurrentPeer(null);
    setCurrentCallId(null);
    setLatestStats(null);
    setConnectionState("new");
  };

  // ── Poll stats every 3 sec during call ──
  useEffect(() => {
    if (phase !== "in-call" || !clientRef.current || !identity || !currentPeer || !currentCallId) return;
    const pc = (clientRef.current as unknown as { pc: RTCPeerConnection }).pc;
    const timer = setInterval(async () => {
      try {
        const s = await collectStats(pc, {
          callId: currentCallId, identity, peer: currentPeer, role: callRoleRef.current,
        });
        setLatestStats(s);
        latestStatsRef.current = s;   // keep fresh for the call-record write
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(timer);
  }, [phase, identity, currentPeer, currentCallId]);

  // ── Render ──
  if (phase === "choose-identity") {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, letterSpacing: 1.2, color: "#8a8776", textTransform: "uppercase", marginBottom: 6 }}>
            NEX Internal Calling · Stage 1 Experiment
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px 0" }}>Pick a NEX identity</h1>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
            Open this page in a second browser (or incognito) and pick the other identity to test a real
            NEX-to-NEX call.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {DEV_IDENTITIES.map((d) => (
              <button
                key={d.id}
                onClick={() => pickIdentity(d.id)}
                style={{ ...bigButtonStyle, background: d.color }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const peers = online.filter((o) => o !== identity);

  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, maxWidth: 900 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1.2, color: "#8a8776", textTransform: "uppercase" }}>
              NEX identity
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{identity}</div>
          </div>
          <div style={{ fontSize: 11, color: "#8a8776" }}>
            {online.length} online · {phase}
          </div>
        </div>

        {/* Peer list · call button per peer */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {peers.length === 0 && (
            <div style={{ fontSize: 12, color: "#8a8776", padding: "8px 12px", background: "#faf7f2", borderRadius: 8 }}>
              Waiting for another NEX identity to come online…
            </div>
          )}
          {peers.map((p) => (
            <button
              key={p}
              onClick={() => startCall(p)}
              disabled={phase !== "idle" && phase !== "ended"}
              style={{ ...bigButtonStyle, background: "#059669", opacity: (phase !== "idle" && phase !== "ended") ? 0.5 : 1 }}
            >
              📞 Call {p}
            </button>
          ))}
        </div>

        {/* Incoming call banner */}
        {phase === "incoming" && incoming && (
          <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Incoming call from {incoming.from}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={acceptIncoming} style={{ ...bigButtonStyle, background: "#059669" }}>Accept</button>
              <button onClick={declineIncoming} style={{ ...bigButtonStyle, background: "#dc2626" }}>Decline</button>
            </div>
          </div>
        )}

        {/* Video panes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#8a8776", marginBottom: 4 }}>You</div>
            <video ref={localVideoRef} autoPlay muted playsInline style={videoStyle} />
          </div>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#8a8776", marginBottom: 4 }}>Remote</div>
            <video ref={remoteVideoRef} autoPlay playsInline style={videoStyle} />
          </div>
        </div>

        {/* Hangup */}
        {(phase === "in-call" || phase === "outgoing") && (
          <button onClick={hangup} style={{ ...bigButtonStyle, background: "#dc2626", width: "100%", marginBottom: 16 }}>
            End call
          </button>
        )}

        {/* Live stats panel */}
        {latestStats && (
          <div style={{ background: "#faf7f2", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 8, padding: 12, marginBottom: 16, fontFamily: "monospace", fontSize: 11 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#8a8776", marginBottom: 6, fontFamily: "system-ui" }}>
              Live measurement · updates every 3s
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <div><b>path:</b> <span style={{ color: latestStats.path === "p2p" ? "#059669" : latestStats.path === "srflx" ? "#0891b2" : latestStats.path === "relay" ? "#dc2626" : "#8a8776" }}>{latestStats.path}</span></div>
              <div><b>state:</b> {latestStats.connectionState}</div>
              <div><b>local ICE:</b> {latestStats.iceLocalType ?? "—"}</div>
              <div><b>remote ICE:</b> {latestStats.iceRemoteType ?? "—"}</div>
              <div><b>bytes sent:</b> {latestStats.bytesSent.toLocaleString()}</div>
              <div><b>bytes recv:</b> {latestStats.bytesReceived.toLocaleString()}</div>
              <div><b>packets lost:</b> {latestStats.packetsLost}</div>
              <div><b>jitter:</b> {latestStats.jitterMs != null ? `${latestStats.jitterMs} ms` : "—"}</div>
              <div><b>RTT:</b> {latestStats.roundTripMs != null ? `${latestStats.roundTripMs} ms` : "—"}</div>
              <div><b>network:</b> {latestStats.networkType ?? "—"}</div>
              <div><b>audio:</b> {latestStats.audioCodec ?? "—"}</div>
              <div><b>video:</b> {latestStats.videoCodec ?? "—"} {latestStats.videoResolution ?? ""}</div>
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: "#8a8776", fontFamily: "system-ui" }}>
              <b>path=p2p or srflx</b> means media bypassed NEX. <b>path=relay</b> means TURN would be needed (Stage 2).
            </div>
          </div>
        )}

        {/* Event log */}
        <div style={{ background: "#111", color: "#dcfce7", borderRadius: 8, padding: 12, fontFamily: "monospace", fontSize: 10, maxHeight: 200, overflowY: "auto" }}>
          <div style={{ color: "#a1a1aa", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1, fontFamily: "system-ui" }}>
            Event log
          </div>
          {log.length === 0 && <div style={{ color: "#71717a" }}>No events yet.</div>}
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>

        <div style={{ marginTop: 12, fontSize: 10, color: "#8a8776" }}>
          Signalling server: <code>{SIGNAL_BASE}</code> · ICE servers: Google STUN only · No TURN
        </div>
      </div>
    </div>
  );
}

// ── Styles ──

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#faf7f2",
  padding: 24,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  fontFamily: "system-ui, sans-serif",
};
const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  maxWidth: 520,
  width: "100%",
};
const bigButtonStyle: React.CSSProperties = {
  padding: "12px 20px",
  fontSize: 14,
  fontWeight: 600,
  color: "#fff",
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
};
const videoStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "4/3",
  background: "#000",
  borderRadius: 8,
  objectFit: "cover",
};
