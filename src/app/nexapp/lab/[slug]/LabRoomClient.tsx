"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface RoomDetail {
  slug: string;
  display_name: string;
  primary_agent_id: string;
  target_records: number;
  harvest_rows: number | null;
  verified_rows: number | null;
  growth_1h_pct: number | null;
  recent_samples: Array<{ name?: string; city?: string; harvested_at?: string }>;
  growth_series: Array<{ ts_iso: string; metric_value: number }>;
}

export function LabRoomClient({ slug }: { slug: string }) {
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/nex/lab/room/${slug}`, { cache: "no-store" });
        if (!r.ok) throw new Error(`http_${r.status}`);
        const j = await r.json();
        if (!cancelled) { setRoom(j); setErr(null); }
      } catch (e) { if (!cancelled) setErr(e instanceof Error ? e.message : "err"); }
    };
    void tick();
    const iv = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [slug]);

  const pct = room && room.target_records > 0 && room.harvest_rows != null
    ? Math.min(100, (room.harvest_rows / room.target_records) * 100) : 0;
  const growth = room?.growth_1h_pct == null ? "—"
    : (room.growth_1h_pct >= 0 ? "+" : "") + room.growth_1h_pct.toFixed(2) + "%/h";

  return (
    <div style={page}>
      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/nexapp/lab" style={{ color: "#94a3b8", textDecoration: "none", fontSize: 12 }}>← Lab</Link>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{room?.display_name ?? slug}</div>
          <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{room?.primary_agent_id ?? ""}</div>
        </div>
        {err && <div style={{ fontSize: 11, color: "#f87171" }}>err · {err}</div>}
      </header>
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Card label="Harvest rows" value={room?.harvest_rows?.toLocaleString() ?? "—"} tone="cyan" sub={`target ${(room?.target_records ?? 0).toLocaleString()}`} />
          <Card label="Verified rows" value={room?.verified_rows?.toLocaleString() ?? "—"} tone="green" sub="cross-source ≥ 2 sources" />
          <Card label="Growth 1 h" value={growth} tone={room?.growth_1h_pct != null && room.growth_1h_pct > 0 ? "green" : "grey"} sub="from nex_lab.growth_history" />
          <Card label="Progress" value={`${pct.toFixed(2)}%`} tone={pct > 50 ? "green" : "cyan"} sub="of target" />
        </div>

        <GrowthChart series={room?.growth_series ?? []} />

        <div style={box}>
          <div style={sectionLabel}>Recent harvest samples (last 15)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {(room?.recent_samples ?? []).map((s, i) => (
              <div key={i} style={sampleRow}>
                <div style={{ flex: 1, color: "#e2e8f0", fontSize: 12 }}>{s.name ?? "(unnamed)"}</div>
                <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{s.city ?? "—"}</div>
                <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", minWidth: 180, textAlign: "right" }}>
                  {s.harvested_at ? new Date(s.harvested_at).toLocaleString() : "—"}
                </div>
              </div>
            ))}
            {(!room || room.recent_samples.length === 0) && (
              <div style={{ color: "#64748b", fontSize: 12 }}>no samples yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GrowthChart({ series }: { series: Array<{ ts_iso: string; metric_value: number }> }) {
  if (series.length < 2) {
    return <div style={box}><div style={sectionLabel}>Growth trend</div><div style={{ color: "#64748b", padding: 12 }}>needs at least 2 snapshots · come back in an hour</div></div>;
  }
  const W = 900, H = 180, pad = 30;
  const xs = series.map((s) => new Date(s.ts_iso).getTime());
  const ys = series.map((s) => s.metric_value);
  const xMin = xs[0], xMax = xs[xs.length - 1];
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xr = xMax - xMin || 1, yr = (yMax - yMin) || 1;
  const pts = series.map((s, i) => {
    const t = (xs[i] - xMin) / xr;
    const v = (s.metric_value - yMin) / yr;
    return `${pad + t * (W - 2 * pad)},${H - pad - v * (H - 2 * pad)}`;
  }).join(" ");
  return (
    <div style={box}>
      <div style={sectionLabel}>Growth trend · harvest_rows over time</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, marginTop: 6 }}>
        <polyline fill="none" stroke="#22c55e" strokeWidth="2" points={pts} />
        <text x={pad} y={pad} fontSize="11" fill="#64748b" fontFamily="monospace">min {yMin.toLocaleString()}</text>
        <text x={W - pad} y={pad} fontSize="11" fill="#4ade80" fontFamily="monospace" textAnchor="end">max {yMax.toLocaleString()}</text>
      </svg>
    </div>
  );
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "cyan" | "green" | "grey" }) {
  const c = tone === "cyan" ? "#67e8f9" : tone === "green" ? "#4ade80" : "#e2e8f0";
  return (
    <div style={{ padding: "14px 16px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: c, marginTop: 2, fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", background: "#0a0d10", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
const header: React.CSSProperties = { padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", background: "#080b0d", position: "sticky", top: 0, zIndex: 10 };
const box: React.CSSProperties = { padding: "14px 16px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 8 };
const sectionLabel: React.CSSProperties = { fontSize: 10, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" };
const sampleRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "5px 8px", background: "#0a0d10", borderRadius: 4 };
