"use client";

// Founder 2026-09-10 · HQ Live client · dark-theme node graph.
// Polls /api/nex/hq/live every 5s. Shows agents + data flow + growth.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WorkingCog } from "@/components/nex-app/hq/WorkingCog";
import { LanguageLiveSection } from "@/components/nex-app/hq/LanguageLiveSection";

// ═══════════════════════════════════════════════════════════════════
// Types (mirror /api/nex/hq/live response · never inflate)
// ═══════════════════════════════════════════════════════════════════

type AgentState = "RUNNING" | "DEGRADED" | "CRASHED" | "STOPPED" | "UNKNOWN";

interface Agent {
  agent_id: string;
  state: AgentState;
  pid: number | null;
  heartbeat_age_ms: number | null;
  is_lab: boolean;
}
interface Node { id: string; label: string; recent_items?: number; items_recent?: number; active?: boolean; last_ts_iso?: string | null; }
interface Edge { from: string; to: string; items_recent: number; active: boolean; }
interface HqLive {
  ts_iso: string;
  agents: Agent[];
  agents_summary: { running: number; degraded: number; crashed: number; total: number };
  data_sources: Node[];
  processing_stages: Node[];
  outputs: Node[];
  edges: Edge[];
  growth: { hourly_pct: number | null; accommodation_rows_now: number | null };
  system: { uptime_agents_pct_24h: number; last_supervisor_run_iso: string | null; harvester_runs_24h: number };
  next_ping_seconds: number;
}

// ═══════════════════════════════════════════════════════════════════
// Node layout · 3 columns · sources · stages · outputs
// ═══════════════════════════════════════════════════════════════════

const COL_SOURCES  = 100;
const COL_STAGE_1  = 380;
const COL_STAGE_2  = 620;
const COL_STAGE_3  = 860;
const COL_OUTPUTS  = 1120;
const NODE_W       = 170;
const NODE_H       = 62;
const ROW_H        = 88;

function positionOf(id: string, live: HqLive): { x: number; y: number } | null {
  const srcIndex = live.data_sources.findIndex((n) => n.id === id);
  if (srcIndex >= 0) return { x: COL_SOURCES, y: 40 + srcIndex * ROW_H };
  const stageOrder = ["stage_harvest", "stage_verify", "stage_prototype", "stage_ui_mock", "stage_monetize"];
  const si = stageOrder.indexOf(id);
  if (si >= 0) {
    const stageCol = si === 0 ? COL_STAGE_1 : si === 1 ? COL_STAGE_1 : si === 2 ? COL_STAGE_2 : si === 3 ? COL_STAGE_3 : COL_STAGE_3;
    const stageRow = si === 0 ? 1 : si === 1 ? 3 : si === 2 ? 2 : si === 3 ? 1 : 3;
    return { x: stageCol, y: 40 + stageRow * ROW_H };
  }
  if (id === "out_promotion") return { x: COL_OUTPUTS, y: 40 + 2 * ROW_H };
  if (id === "out_main_nex")  return { x: COL_OUTPUTS, y: 40 + 3 * ROW_H };
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════

export function HqLiveClient() {
  const [live, setLive] = useState<HqLive | null>(null);
  const [lastFetchMs, setLastFetchMs] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [tickCount, setTickCount] = useState(0);
  // SSR-safe: always start as online + visible. Real values sync from
  // window/document in useEffect below · avoids hydration mismatch.
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [tabVisible, setTabVisible] = useState<boolean>(true);
  const growthHistory = useRef<Array<{ ts: number; rows: number }>>([]);
  const tickRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/nex/hq/live", {
          cache: "no-store",
          credentials: "same-origin",  // send admin cookie only · never cross-origin
        });
        if (r.status === 401) throw new Error("unauthorised · founder cookie required");
        if (!r.ok) throw new Error(`http_${r.status}`);
        const data = (await r.json()) as HqLive;
        if (cancelled) return;
        setLive(data);
        setLastFetchMs(Date.now());
        setError(null);
        if (data.growth.accommodation_rows_now != null) {
          growthHistory.current.push({ ts: Date.now(), rows: data.growth.accommodation_rows_now });
          if (growthHistory.current.length > 200) growthHistory.current.shift();
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "fetch_failed");
      } finally {
        if (!cancelled) setTickCount((n) => n + 1);
      }
    };
    tickRef.current = tick;
    void tick();
    // Poll every 5s under normal conditions · every 30s in background tab
    const iv = setInterval(() => {
      if (!cancelled && (tabVisible || Date.now() - lastFetchMs > 25_000)) tick();
    }, 5000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [tabVisible, lastFetchMs]);

  // WiFi reconnect · instant re-poll when browser regains network.
  // Reads navigator.onLine on mount (post-hydration) to sync real state.
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline = () => { setIsOnline(true); void tickRef.current(); };
    const onOffline = () => { setIsOnline(false); setError("wifi_offline · will re-poll on reconnect"); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Tab visibility · instant re-poll when tab comes back to foreground.
  // Reads document.hidden on mount to sync real state post-hydration.
  useEffect(() => {
    setTabVisible(!document.hidden);
    const onVis = () => {
      const visible = !document.hidden;
      setTabVisible(visible);
      if (visible) void tickRef.current(); // re-poll immediately when re-focused
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const staleMs = lastFetchMs > 0 ? nowTs - lastFetchMs : 0;
  const isStale = staleMs > 15_000;

  const growthHourlyPct = (() => {
    const buf = growthHistory.current;
    if (buf.length < 2) return null;
    const now = buf[buf.length - 1];
    const target = now.ts - 3600_000;
    let best = buf[0];
    for (const s of buf) if (Math.abs(s.ts - target) < Math.abs(best.ts - target)) best = s;
    if (best === now) return null;
    if (best.rows === 0) return null;
    return ((now.rows - best.rows) / best.rows) * 100;
  })();

  return (
    <div style={pageStyle}>
      <Header live={live} staleMs={staleMs} isStale={isStale} error={error} tickCount={tickCount} growthHourlyPct={growthHourlyPct} isOnline={isOnline} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 20px", gap: 16 }}>
        <Metrics live={live} />
        <NodeGraph live={live} />
        <LabRoomsGrid />
        <LanguageLiveSection />
        <AgentGrid live={live} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Lab Rooms grid · pulls from /api/nex/lab/status every 5s
// ═══════════════════════════════════════════════════════════════════

interface LabRoomStatus {
  slug: string;
  display_name: string;
  primary_agent_id: string;
  target_records: number;
  harvest_rows: number | null;
  verified_rows: number | null;
  growth_1h_pct: number | null;
  latest_snapshot_iso: string | null;
  last_harvested_age_sec: number | null;
  last_harvested_at_iso: string | null;
}
interface LabStatus {
  ts_iso: string;
  total_rooms: number;
  total_harvest_rows: number;
  total_verified_rows: number;
  pending_promotions: number;
  rooms: LabRoomStatus[];
}

function LabRoomsGrid() {
  const [lab, setLab] = useState<LabStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/nex/lab/status", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) setLab(d);
      } catch { /* silent · HQ shows lab section blank when lab endpoint unreachable */ }
    };
    void tick();
    const iv = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);
  return (
    <div style={{ padding: "12px 14px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Lab Rooms · Master AI orchestrated
        </div>
        {lab && (
          <div style={{ display: "flex", gap: 10, fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
            <span>rooms {lab.total_rooms}</span>
            <span>harvest {lab.total_harvest_rows.toLocaleString()}</span>
            <span>verified {lab.total_verified_rows.toLocaleString()}</span>
            <span>pending promotions {lab.pending_promotions}</span>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
        {(lab?.rooms ?? []).map((r) => {
          const progressPct = r.target_records > 0 && r.harvest_rows != null
            ? Math.min(100, (r.harvest_rows / r.target_records) * 100)
            : 0;
          const growthLabel = r.growth_1h_pct == null ? "—" :
            (r.growth_1h_pct >= 0 ? "+" : "") + r.growth_1h_pct.toFixed(1) + "%/h";
          return (
            <div key={r.slug} style={{
              padding: 10, background: "#0a0d10", borderRadius: 6,
              border: "1px solid #1e293b",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <WorkingCog signals={{ last_harvested_age_sec: r.last_harvested_age_sec, growth_1h_pct: r.growth_1h_pct }} size={16} />
                  <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>{r.display_name}</div>
                </div>
                <div style={{ fontSize: 10, color: r.growth_1h_pct != null && r.growth_1h_pct > 0 ? "#4ade80" : "#64748b", fontFamily: "monospace" }}>{growthLabel}</div>
              </div>
              <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginBottom: 6 }}>{r.primary_agent_id}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                <span style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{(r.harvest_rows ?? 0).toLocaleString()}</span>
                {" / "}
                <span style={{ fontFamily: "monospace" }}>{r.target_records.toLocaleString()}</span>
                <span style={{ marginLeft: 6, color: "#4ade80" }}>· {(r.verified_rows ?? 0).toLocaleString()} verified</span>
              </div>
              <div style={{ height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${progressPct}%`, height: "100%", background: progressPct > 0 ? "#22c55e" : "transparent" }} />
              </div>
            </div>
          );
        })}
        {lab && lab.rooms.length === 0 && (
          <div style={{ fontSize: 12, color: "#64748b" }}>no rooms registered</div>
        )}
        {!lab && (
          <div style={{ fontSize: 12, color: "#64748b" }}>loading lab status…</div>
        )}
      </div>
    </div>
  );
}

function Header({ live, staleMs, isStale, error, tickCount, growthHourlyPct, isOnline }: {
  live: HqLive | null; staleMs: number; isStale: boolean; error: string | null;
  tickCount: number; growthHourlyPct: number | null; isOnline: boolean;
}) {
  const running = live?.agents_summary.running ?? 0;
  const total = live?.agents_summary.total ?? 0;
  const growthLabel = growthHourlyPct == null ? "—" :
    (growthHourlyPct >= 0 ? "+" : "") + growthHourlyPct.toFixed(2) + "%";
  return (
    <header style={headerStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: isStale ? "#ef4444" : "#22c55e", boxShadow: isStale ? "none" : "0 0 8px #22c55e88" }} />
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>NEX · HQ · LIVE</div>
        <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
          {live ? new Date(live.ts_iso).toLocaleTimeString() : "connecting…"}
          {" · tick "}{tickCount}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <StatChip label="agents" value={`${running}/${total}`} tone={running === total && total > 0 ? "good" : "warn"} />
        <StatChip label="growth/hr" value={growthLabel} tone="good" />
        <StatChip label="wifi" value={isOnline ? "online" : "OFFLINE"} tone={isOnline ? "good" : "bad"} />
        <StatChip label="ping" value={`${live?.next_ping_seconds ?? 5}s`} tone="neutral" />
        {isStale && <StatChip label="STALE" value={`${Math.floor(staleMs / 1000)}s`} tone="bad" />}
        {error && !isStale && <StatChip label="err" value={error.slice(0, 18)} tone="bad" />}
        <div style={{ display: "flex", gap: 6, marginLeft: 8, paddingLeft: 12, borderLeft: "1px solid #1e293b" }}>
          <style dangerouslySetInnerHTML={{
            __html: `
              @keyframes nexapp-hq-wm-pulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
                50%      { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
              }
              .nexapp-hq-wm { animation: nexapp-hq-wm-pulse 2s ease-in-out infinite; }
              .nexapp-hq-wm:hover { filter: brightness(1.1); }
            `,
          }} />
          <Link
            href="/nex-head-quarters/work-map"
            className="nexapp-hq-wm"
            style={{
              padding: "6px 12px",
              background: "linear-gradient(90deg, #10b981 0%, #059669 100%)",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 800,
              borderRadius: 6,
              border: "1px solid #34d399",
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            title="NEX Master Work & Architecture Map · founder-facing progress dashboard"
          >
            🗺 Work Map →
          </Link>
          <Link href="/nexapp/lab" style={{ padding: "6px 10px", background: "#052e16", color: "#4ade80", textDecoration: "none", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "1px solid #14532d", whiteSpace: "nowrap" }}>Labs →</Link>
          <Link href="/nexapp/lab#innovation" style={{ padding: "6px 10px", background: "#2e1065", color: "#c4b5fd", textDecoration: "none", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "1px solid #4c1d95", whiteSpace: "nowrap" }}>💡 Creative →</Link>
          <Link href="/nexapp/nex-agent" style={{ padding: "6px 10px", background: "#0c4a6e", color: "#7dd3fc", textDecoration: "none", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "1px solid #075985", whiteSpace: "nowrap" }}>nex1 →</Link>
        </div>
      </div>
    </header>
  );
}

function StatChip({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const bg = tone === "good" ? "#052e16" : tone === "warn" ? "#422006" : tone === "bad" ? "#450a0a" : "#0f172a";
  const fg = tone === "good" ? "#4ade80" : tone === "warn" ? "#fbbf24" : tone === "bad" ? "#f87171" : "#94a3b8";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 10px", borderRadius: 6, background: bg }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: fg, opacity: 0.85 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: fg, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

function Metrics({ live }: { live: HqLive | null }) {
  const rows = live?.growth.accommodation_rows_now ?? null;
  const uptime = live?.system.uptime_agents_pct_24h ?? 0;
  const runs = live?.system.harvester_runs_24h ?? 0;
  const supRun = live?.system.last_supervisor_run_iso;
  const supAgeMin = supRun ? Math.floor((Date.now() - Date.parse(supRun)) / 60_000) : null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      <MetricCard label="Accommodation rows"        value={rows != null ? rows.toLocaleString() : "—"} sub="local Postgres · nex.accommodation_business" />
      <MetricCard label="Agents uptime · 24 h"      value={`${uptime.toFixed(1)}%`} sub={`${live?.agents_summary.running ?? 0} of ${live?.agents_summary.total ?? 0} running now`} />
      <MetricCard label="Harvester runs · 24 h"     value={runs.toString()} sub="OSM Overpass · Indonesia cities" />
      <MetricCard label="Master AI · last cycle"    value={supAgeMin != null ? `${supAgeMin} min ago` : "—"} sub="15-min supervisor" />
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ padding: "12px 14px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#e2e8f0", marginTop: 2, fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function NodeGraph({ live }: { live: HqLive | null }) {
  if (!live) return <div style={graphContainerStyle}>connecting…</div>;
  const width = COL_OUTPUTS + NODE_W + 40;
  const height = 40 + 6 * ROW_H;
  const allNodes: Array<{ id: string; label: string; items?: number; active?: boolean; kind: "source" | "stage" | "output" }> = [
    ...live.data_sources.map((n) => ({ id: n.id, label: n.label, items: n.recent_items, active: n.active, kind: "source" as const })),
    ...live.processing_stages.map((n) => ({ id: n.id, label: n.label, items: n.items_recent, active: n.active, kind: "stage" as const })),
    ...live.outputs.map((n) => ({ id: n.id, label: n.label, items: n.items_recent, active: (n.items_recent ?? 0) > 0, kind: "output" as const })),
  ];
  return (
    <div style={graphContainerStyle}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
        <defs>
          <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#22c55e" />
          </marker>
          <marker id="arrow-grey" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
          </marker>
        </defs>
        {Array.from({ length: Math.floor(width / 20) }).map((_, ix) =>
          Array.from({ length: Math.floor(height / 20) }).map((_, iy) => (
            <circle key={`${ix}-${iy}`} cx={ix * 20 + 10} cy={iy * 20 + 10} r="0.7" fill="#1e293b" />
          )),
        )}
        {live.edges.map((e, i) => {
          const from = positionOf(e.from, live);
          const to = positionOf(e.to, live);
          if (!from || !to) return null;
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          const midX = (x1 + x2) / 2;
          const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
          const color = e.active ? "#22c55e" : "#334155";
          const marker = e.active ? "url(#arrow-green)" : "url(#arrow-grey)";
          return (
            <g key={i}>
              <path d={d} stroke={color} strokeWidth={e.active ? 1.8 : 1} fill="none" markerEnd={marker} opacity={e.active ? 1 : 0.55} />
              {e.items_recent > 0 && (
                <g>
                  <rect x={midX - 22} y={((y1 + y2) / 2) - 8} width="44" height="16" rx="8" fill="#0f1418" stroke={color} strokeWidth="0.8" />
                  <text x={midX} y={((y1 + y2) / 2) + 3} textAnchor="middle" fontSize="10" fill={color} fontFamily="monospace">
                    {e.items_recent > 999 ? Math.round(e.items_recent / 100) / 10 + "k" : e.items_recent} items
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {allNodes.map((n) => {
          const p = positionOf(n.id, live);
          if (!p) return null;
          const active = n.active !== false && (n.items ?? 0) > 0;
          const stroke = active ? "#22c55e" : "#334155";
          const fill = "#111a20";
          return (
            <g key={n.id}>
              <rect x={p.x} y={p.y} width={NODE_W} height={NODE_H} rx="10" fill={fill} stroke={stroke} strokeWidth="1.5" />
              <circle cx={p.x + 14} cy={p.y + NODE_H / 2} r="6" fill={active ? "#22c55e" : "#475569"} />
              {active && <circle cx={p.x + 14} cy={p.y + NODE_H / 2} r="10" fill="none" stroke="#22c55e" strokeWidth="0.5" opacity="0.5">
                <animate attributeName="r" from="6" to="14" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.5" to="0" dur="1.6s" repeatCount="indefinite" />
              </circle>}
              <text x={p.x + 28} y={p.y + 24} fontSize="12" fill="#e2e8f0" fontWeight="600">{n.label}</text>
              <text x={p.x + 28} y={p.y + 42} fontSize="10" fill={active ? "#4ade80" : "#64748b"} fontFamily="monospace">
                {n.kind === "source" ? "source" : n.kind === "stage" ? "stage" : "output"} · {(n.items ?? 0).toLocaleString()} items
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AgentGrid({ live }: { live: HqLive | null }) {
  const agents = live?.agents ?? [];
  return (
    <div style={{ padding: "12px 14px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
        Agents (live heartbeat)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
        {agents.map((a) => {
          const dot = a.state === "RUNNING" ? "#22c55e"
                   : a.state === "DEGRADED" ? "#fbbf24"
                   : a.state === "CRASHED"  ? "#ef4444"
                   : "#475569";
          const ageStr = a.heartbeat_age_ms == null ? "—"
                      : a.heartbeat_age_ms < 60_000 ? `${Math.round(a.heartbeat_age_ms / 1000)}s`
                      : `${Math.round(a.heartbeat_age_ms / 60_000)}m`;
          return (
            <div key={a.agent_id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", background: "#0a0d10", borderRadius: 6,
              border: `1px solid ${a.state === "RUNNING" ? "#052e16" : "#1e293b"}`,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: dot }} />
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.agent_id}{a.is_lab ? " (lab)" : ""}
                </div>
                <div style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace" }}>
                  {a.state} · {ageStr}{a.pid ? ` · pid ${a.pid}` : ""}
                </div>
              </div>
            </div>
          );
        })}
        {agents.length === 0 && <div style={{ fontSize: 12, color: "#64748b" }}>no heartbeats found</div>}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0d10",
  color: "#e2e8f0",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  display: "flex",
  flexDirection: "column",
};
const headerStyle: React.CSSProperties = {
  padding: "10px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #1e293b",
  background: "#080b0d",
  position: "sticky",
  top: 0,
  zIndex: 10,
};
const graphContainerStyle: React.CSSProperties = {
  background: "#0f1418",
  border: "1px solid #1e293b",
  borderRadius: 8,
  padding: 12,
  overflowX: "auto",
};
