// WO-LIVE-WORKFORCE-PROOF-01 · Agent Reality Card view.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const TOKEN = {
  bg: "#faf7f2", card: "#ffffff", border: "#e6e2d9", divider: "#edeae4",
  text: "#1f1d18", textSoft: "#8a8477", textMid: "#57534a",
  accent: "#c2803b", success: "#10b981", warning: "#f59e0b", danger: "#dc2626",
};

const TIER_COLOUR: Record<string, string> = {
  CLAIMED: "#94a3b8", RUNTIME_VERIFIED: "#10b981",
  PRODUCTION_VERIFIED: "#3b82f6", NOT_APPLICABLE: "#cbd5e1",
};

interface RealityCard {
  agent_id: string; agent_name: string; lane: string;
  identity_status: string; runtime_status: string; identity_id: string | null;
  heartbeat_state: string;
  colour: "green" | "yellow" | "orange" | "red" | "black" | "grey";
  colour_reason: string;
  brain_tier: string; memory_tier: string; tools_tier: string;
  network_tier: string; vision_tier: string;
  internet_status: string;
  internet_last_success_at: string | null; internet_last_source: string | null;
  internet_last_http_status: number | null; internet_last_bytes: number | null;
  internet_last_evidence_ref: string | null;
  current_mission_id: string | null;
  last_heartbeat_age_s: number | null; last_meaningful_progress_age_s: number | null;
  last_external_request_age_s: number | null; last_memory_update_age_s: number | null;
  last_evidence_age_s: number | null;
  output_1h: { heartbeats: number; memory_writes: number; performance_records: number; learning_contributions: number };
  nex_contribution: { validated_findings_1h: number; proposals_1h: number; knowledge_1h: number };
}

interface RealityResponse {
  record_type: string; generated_at: string;
  observed_window_ms: number; observed_window_label: string;
  agents: RealityCard[];
}

function ageLabel(s: number | null): string {
  if (s === null) return "—";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

function ageColour(s: number | null, freshThreshold = 60): string {
  if (s === null) return TOKEN.textSoft;
  if (s < freshThreshold) return TOKEN.success;
  if (s < 300) return TOKEN.warning;
  return TOKEN.danger;
}

export default function RealityPage() {
  const [snap, setSnap] = useState<RealityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/nex/hq/agents/reality", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSnap((await res.json()) as RealityResponse);
      setError(null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const agents = snap?.agents ?? [];

  return (
    <div style={{ minHeight: "100vh", background: TOKEN.bg, padding: 24, color: TOKEN.text, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>
        <header style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26 }}>NEX Agent Reality Cards</h1>
            <p style={{ margin: "4px 0 0", color: TOKEN.textMid, fontSize: 13 }}>
              Is this agent GENUINELY doing something? · Every number backed by a live GB record
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: TOKEN.textSoft }}>
            {loading ? "…" : snap ? `Snapshot: ${new Date(snap.generated_at).toLocaleTimeString()}` : ""}
            {error && <span style={{ color: TOKEN.danger }}>{error}</span>}
            <Link href="/nex-head-quarters/agents/proof" style={{ color: TOKEN.accent }}>Proof cards</Link>
            <Link href="/nex-head-quarters/agents/knowledge-flow" style={{ color: TOKEN.accent }}>Knowledge flow</Link>
            <Link href="/nex-head-quarters" style={{ color: TOKEN.accent }}>← HQ</Link>
          </div>
        </header>

        <div style={{ marginBottom: 16, padding: 10, background: TOKEN.card, border: `1px solid ${TOKEN.border}`, borderRadius: 10, fontSize: 13, color: TOKEN.textMid }}>
          OBSERVED WINDOW: <strong style={{ color: snap?.observed_window_ms ? TOKEN.text : TOKEN.danger }}>{snap?.observed_window_label ?? "—"}</strong>
          {snap && snap.observed_window_ms > 0 && snap.observed_window_ms < 24 * 3600_000 && (
            <span style={{ marginLeft: 8, fontSize: 11, color: TOKEN.textSoft }}>(honest — not a fabricated 24h)</span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(440px, 1fr))", gap: 14 }}>
          {agents.map((a) => <RealityCardView key={a.agent_id} card={a} />)}
        </div>
      </div>
    </div>
  );
}

const COLOUR_MAP: Record<RealityCard["colour"], { bg: string; dot: string; icon: string }> = {
  green:  { bg: "#10b981", dot: "🟢", icon: "🟢" },
  yellow: { bg: "#f59e0b", dot: "🟡", icon: "🟡" },
  orange: { bg: "#ea580c", dot: "🟠", icon: "🟠" },
  red:    { bg: "#dc2626", dot: "🔴", icon: "🔴" },
  black:  { bg: "#1f1d18", dot: "⚫", icon: "⚫" },
  grey:   { bg: "#8a8477", dot: "⚪", icon: "⚪" },
};

function RealityCardView({ card }: { card: RealityCard }): React.ReactElement {
  const isNoNetwork = card.internet_status === "NOT_APPLICABLE";
  const colourInfo = COLOUR_MAP[card.colour] ?? COLOUR_MAP.grey;
  return (
    <div style={{ background: TOKEN.card, border: `2px solid ${colourInfo.bg}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            <span style={{ marginRight: 6 }}>{colourInfo.icon}</span>
            {card.agent_name}
          </h3>
          <div style={{ fontSize: 11, color: TOKEN.textSoft }}>{card.agent_id} · {card.lane}</div>
          <div style={{ fontSize: 11, marginTop: 4, padding: "2px 8px", background: colourInfo.bg + "22", borderRadius: 6, color: colourInfo.bg, fontWeight: 600, display: "inline-block" }}>
            {card.heartbeat_state}
          </div>
          <div style={{ fontSize: 10, color: TOKEN.textMid, marginTop: 4 }} title={card.colour_reason}>
            {card.colour_reason.slice(0, 100)}{card.colour_reason.length > 100 ? "…" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexDirection: "column", alignItems: "flex-end" }}>
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: card.identity_status === "VERIFIED" ? TOKEN.success : TOKEN.danger, color: "#fff" }}>{card.identity_status}</span>
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: card.runtime_status === "RUNNING" ? TOKEN.success : card.runtime_status === "IDLE" ? TOKEN.warning : TOKEN.textSoft, color: "#fff" }}>runtime {card.runtime_status}</span>
        </div>
      </div>

      {/* Facet mini-row */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap", fontSize: 10 }}>
        <FacetChip label="Brain" tier={card.brain_tier} />
        <FacetChip label="Memory" tier={card.memory_tier} />
        <FacetChip label="Tools" tier={card.tools_tier} />
        <FacetChip label="Network" tier={card.network_tier} />
        <FacetChip label="Vision" tier={card.vision_tier} />
      </div>

      {/* Internet card */}
      {!isNoNetwork && (
        <div style={{ marginBottom: 10, padding: 10, background: card.internet_status === "ACTIVE" ? "#f0f9f4" : "#f8f5ef", border: `1px solid ${card.internet_status === "ACTIVE" ? TOKEN.success : TOKEN.border}`, borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <strong style={{ fontSize: 12 }}>🌐 INTERNET</strong>
            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: card.internet_status === "ACTIVE" ? TOKEN.success : TOKEN.warning, color: "#fff" }}>{card.internet_status}</span>
          </div>
          <div style={{ fontSize: 11, color: TOKEN.textMid, display: "grid", gap: 2, fontFamily: "ui-monospace, monospace" }}>
            <div>last success: <strong style={{ color: TOKEN.text }}>{card.internet_last_success_at ? new Date(card.internet_last_success_at).toLocaleTimeString() : "never"}</strong></div>
            {card.internet_last_source && <div>source: {card.internet_last_source.slice(0, 60)}{card.internet_last_source.length > 60 ? "…" : ""}</div>}
            {card.internet_last_http_status !== null && <div>HTTP: {card.internet_last_http_status}</div>}
            {card.internet_last_bytes !== null && <div>bytes: {card.internet_last_bytes.toLocaleString()}</div>}
            {card.internet_last_evidence_ref && <div>evidence: {card.internet_last_evidence_ref.slice(0, 40)}</div>}
          </div>
        </div>
      )}

      {/* Live-signal row */}
      <div style={{ marginBottom: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
        <div>Current mission: <strong style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{card.current_mission_id ? card.current_mission_id.slice(-20) : "—"}</strong></div>
        <div>Last heartbeat: <strong style={{ color: ageColour(card.last_heartbeat_age_s) }}>{ageLabel(card.last_heartbeat_age_s)}</strong></div>
        <div>Last progress: <strong style={{ color: ageColour(card.last_meaningful_progress_age_s, 120) }}>{ageLabel(card.last_meaningful_progress_age_s)}</strong></div>
        <div>Last external req: <strong style={{ color: ageColour(card.last_external_request_age_s, 300) }}>{ageLabel(card.last_external_request_age_s)}</strong></div>
        <div>Last memory: <strong style={{ color: ageColour(card.last_memory_update_age_s, 300) }}>{ageLabel(card.last_memory_update_age_s)}</strong></div>
        <div>Last evidence: <strong style={{ color: ageColour(card.last_evidence_age_s, 120) }}>{ageLabel(card.last_evidence_age_s)}</strong></div>
      </div>

      {/* 1-hour output */}
      <div style={{ marginBottom: 8, padding: 8, background: "#f8f5ef", borderRadius: 6, fontSize: 11, color: TOKEN.textMid }}>
        <strong style={{ color: TOKEN.text }}>1-hour output</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 2, marginTop: 4 }}>
          <div>❤️ Heartbeats: <strong>{card.output_1h.heartbeats}</strong></div>
          <div>🗃️ Memory writes: <strong>{card.output_1h.memory_writes}</strong></div>
          <div>📈 Missions: <strong>{card.output_1h.performance_records}</strong></div>
          <div>🧠➡️📚 Learning: <strong>{card.output_1h.learning_contributions}</strong></div>
        </div>
      </div>

      {/* NEX contribution */}
      <div style={{ padding: 8, background: "#eff6ff", borderRadius: 6, fontSize: 11, color: TOKEN.textMid }}>
        <strong style={{ color: TOKEN.text }}>NEX contribution (1h)</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, marginTop: 4 }}>
          <div>Validated: <strong>{card.nex_contribution.validated_findings_1h}</strong></div>
          <div>Proposals: <strong>{card.nex_contribution.proposals_1h}</strong></div>
          <div>Knowledge: <strong>{card.nex_contribution.knowledge_1h}</strong></div>
        </div>
      </div>
    </div>
  );
}

function FacetChip({ label, tier }: { label: string; tier: string }): React.ReactElement {
  return (
    <span style={{ padding: "2px 6px", borderRadius: 4, background: TIER_COLOUR[tier] + "22", border: `1px solid ${TIER_COLOUR[tier]}55`, color: TIER_COLOUR[tier], fontWeight: 600 }}>
      {label}: {tier.replace("_", " ")}
    </span>
  );
}
