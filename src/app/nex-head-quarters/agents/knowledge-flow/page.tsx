// WO-DASHBOARD-24H-KNOWLEDGE-01 · per-agent 24h knowledge flow dashboard.
//
// Route: /nex-head-quarters/agents/knowledge-flow

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const TOKEN = {
  bg:       "#faf7f2",
  card:     "#ffffff",
  border:   "#e6e2d9",
  divider:  "#edeae4",
  text:     "#1f1d18",
  textSoft: "#8a8477",
  textMid:  "#57534a",
  accent:   "#c2803b",
  success:  "#10b981",
  danger:   "#dc2626",
};

interface AgentKnowledgeFlow {
  agent_id: string;
  agent_name: string;
  lane: string;
  wire_upstream: readonly string[];
  wire_downstream: readonly string[];
  knowledge_update_pct_24h: number;
  memory_records_24h: number;
  learning_contributions_24h: number;
  work_in_per_hour: number;
  work_out_per_hour: number;
  hourly_activity_24h: readonly number[];
}

interface KnowledgeFlowResponse {
  record_type: "NEX_HQ_KNOWLEDGE_FLOW";
  generated_at: string;
  window_ms: number;
  observed_window_ms: number;
  observed_window_label: string;
  agents: AgentKnowledgeFlow[];
}

export default function KnowledgeFlowPage() {
  const [snap, setSnap] = useState<KnowledgeFlowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/nex/hq/knowledge-flow", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSnap((await res.json()) as KnowledgeFlowResponse);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const agents = snap?.agents ?? [];
  const totalMemory24h = agents.reduce((s, a) => s + a.memory_records_24h, 0);
  const totalLearn24h = agents.reduce((s, a) => s + a.learning_contributions_24h, 0);
  const activeAgents = agents.filter((a) => a.hourly_activity_24h.some((v) => v > 0));

  const byLane = new Map<string, AgentKnowledgeFlow[]>();
  for (const a of agents) {
    const arr = byLane.get(a.lane) ?? [];
    arr.push(a);
    byLane.set(a.lane, arr);
  }

  return (
    <div style={{ minHeight: "100vh", background: TOKEN.bg, padding: 24, color: TOKEN.text, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>
        <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>NEX Knowledge Flow · 24h</h1>
            <p style={{ margin: "4px 0 0", color: TOKEN.textMid, fontSize: 14 }}>
              Per-agent 24h knowledge update % · work in/out flow · hourly activity sparkline
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 13, color: TOKEN.textSoft }}>
            {loading ? "Loading…" : snap ? `Snapshot: ${new Date(snap.generated_at).toLocaleTimeString()}` : ""}
            {error && <span style={{ color: TOKEN.danger }}>Error: {error}</span>}
            <Link href="/nex-head-quarters/agents/proof" style={{ color: TOKEN.accent }}>Proof cards</Link>
            <Link href="/nex-head-quarters" style={{ color: TOKEN.accent }}>← HQ</Link>
          </div>
        </header>

        {/* Summary strip */}
        <div style={{ marginBottom: 20, padding: 12, background: TOKEN.card, border: `1px solid ${TOKEN.border}`, borderRadius: 10, display: "flex", flexWrap: "wrap", gap: 20, fontSize: 13 }}>
          <div><strong>{agents.length}</strong> agents</div>
          <div><strong>{activeAgents.length}</strong> active in last 24h</div>
          <div><strong>{totalMemory24h}</strong> memory records 24h</div>
          <div><strong>{totalLearn24h}</strong> learning contributions 24h</div>
          <div style={{ color: TOKEN.textSoft }}>
            OBSERVED WINDOW: <strong style={{ color: snap?.observed_window_ms ? TOKEN.text : TOKEN.danger }}>{snap?.observed_window_label ?? "—"}</strong>
            {snap && snap.observed_window_ms > 0 && snap.observed_window_ms < 24 * 3600_000 && (
              <span style={{ marginLeft: 8, fontSize: 11, color: TOKEN.textSoft }}>(genuinely observed · not a 24h fabrication)</span>
            )}
          </div>
        </div>

        {/* Per-lane sections */}
        {Array.from(byLane.entries()).map(([lane, laneAgents]) => (
          <section key={lane} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, margin: "0 0 12px", color: TOKEN.textMid }}>{lane} lane</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 12 }}>
              {laneAgents.map((a) => <KnowledgeCard key={a.agent_id} agent={a} />)}
            </div>
          </section>
        ))}

        <footer style={{ marginTop: 40, padding: 12, fontSize: 12, color: TOKEN.textSoft, borderTop: `1px solid ${TOKEN.divider}` }}>
          Knowledge update % = 24h learning contributions ÷ 24h memory writes. Work in/out per hour = upstream/downstream agents' 24h missions completed ÷ 24. Sparkline: 24 hourly buckets of this agent's signed heartbeat count (leftmost = 23h ago; rightmost = last hour).
        </footer>
      </div>
    </div>
  );
}

function KnowledgeCard({ agent }: { agent: AgentKnowledgeFlow }): React.ReactElement {
  const pct = agent.knowledge_update_pct_24h;
  const pctColour = pct >= 50 ? TOKEN.success : pct >= 10 ? TOKEN.accent : TOKEN.textSoft;
  const totalActivity = agent.hourly_activity_24h.reduce((s, v) => s + v, 0);
  const maxHour = Math.max(1, ...agent.hourly_activity_24h);

  return (
    <div style={{ background: TOKEN.card, border: `1px solid ${TOKEN.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{agent.agent_name}</h3>
          <div style={{ fontSize: 11, color: TOKEN.textSoft }}>{agent.agent_id}</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: pctColour }}>{pct}%</div>
      </div>

      {/* Sparkline */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", height: 32, alignItems: "flex-end", gap: 1, padding: 4, background: "#f8f5ef", borderRadius: 4 }}>
          {agent.hourly_activity_24h.map((v, i) => (
            <div key={i}
                 title={`${23 - i}h ago: ${v} heartbeats`}
                 style={{
                   flex: 1,
                   height: `${Math.max(2, (v / maxHour) * 100)}%`,
                   background: v > 0 ? pctColour : TOKEN.textSoft + "33",
                   borderRadius: 1,
                 }} />
          ))}
        </div>
        <div style={{ marginTop: 2, display: "flex", justifyContent: "space-between", fontSize: 10, color: TOKEN.textSoft }}>
          <span>-23h</span>
          <span>total: {totalActivity} HB</span>
          <span>now</span>
        </div>
      </div>

      {/* Flow row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
        <div style={{ padding: 6, background: "#f0f9f4", borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: TOKEN.textSoft }}>WORK IN /hr</div>
          <div style={{ fontWeight: 600, color: TOKEN.success }}>{agent.work_in_per_hour.toFixed(2)}</div>
          {agent.wire_upstream.length > 0 && (
            <div style={{ fontSize: 10, color: TOKEN.textMid, marginTop: 2 }}>
              ← {agent.wire_upstream.map((u) => u.slice(0, 16)).join(", ").slice(0, 40)}
            </div>
          )}
        </div>
        <div style={{ padding: 6, background: "#fef8f0", borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: TOKEN.textSoft }}>WORK OUT /hr</div>
          <div style={{ fontWeight: 600, color: TOKEN.accent }}>{agent.work_out_per_hour.toFixed(2)}</div>
          {agent.wire_downstream.length > 0 && (
            <div style={{ fontSize: 10, color: TOKEN.textMid, marginTop: 2 }}>
              → {agent.wire_downstream.map((d) => d.slice(0, 16)).join(", ").slice(0, 40)}
            </div>
          )}
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 11, color: TOKEN.textMid }}>
        <div>🗃️ memory 24h: <strong>{agent.memory_records_24h}</strong></div>
        <div>🧠➡️📚 learn 24h: <strong>{agent.learning_contributions_24h}</strong></div>
      </div>
    </div>
  );
}
