// WO-HQ-PROOF-CARDS-01 · full proof-card view.
//
// Route: /nex-head-quarters/agents/proof
// Every displayed field on every card is backed by a real GB record.
// Founder-locked 2026-09-13: NO EVIDENCE = NO CLAIM.

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
  warning:  "#f59e0b",
  danger:   "#dc2626",
  info:     "#3b82f6",
  claimed:  "#94a3b8",
  runtime:  "#10b981",
  prod:     "#3b82f6",
  na:       "#cbd5e1",
};

interface FacetProof {
  facet: string;
  tier: "CLAIMED" | "RUNTIME_VERIFIED" | "PRODUCTION_VERIFIED" | "NOT_APPLICABLE";
  evidence_count_24h: number;
  evidence_pointer: string | null;
  last_verified_at: string | null;
}

interface ProofCard {
  agent_id: string;
  agent_name: string;
  lane: string;
  identity: null | {
    identity_id: string;
    runtime_key_public_hex_prefix: string;
    spawned_at: string;
    runtime_version: string;
  };
  facets: FacetProof[];
  signed_heartbeats_24h: number;
  signed_heartbeats_ever: number;
  memory_records: number;
  performance_records_24h: number;
  learning_contributions_24h: number;
  latest_evidence_ref: string | null;
  latest_heartbeat_emitted_at: string | null;
  authority: null | {
    authorised_tools: readonly string[];
    authorised_hosts: readonly string[];
    prohibited_actions: readonly string[];
  };
}

interface ProofResponse {
  record_type: "NEX_HQ_AGENT_PROOF_CARDS";
  generated_at: string;
  agents: ProofCard[];
}

const FACET_LABEL: Record<string, { icon: string; short: string }> = {
  brain:                 { icon: "🧠", short: "Brain" },
  memory:                { icon: "🗃️", short: "Memory" },
  tools:                 { icon: "🛠️", short: "Tools" },
  vision:                { icon: "👁️", short: "Vision" },
  network:               { icon: "🌐", short: "Network" },
  experiment:            { icon: "🧪", short: "Experiment" },
  knowledge:             { icon: "📚", short: "Knowledge" },
  identity:              { icon: "🪪", short: "Identity" },
  liveness:              { icon: "❤️", short: "Liveness" },
  performance_history:   { icon: "📈", short: "Perf" },
  evidence:              { icon: "🧾", short: "Evidence" },
  training_state:        { icon: "🎓", short: "Training" },
  authority_boundary:    { icon: "🔐", short: "Authority" },
  recovery_state:        { icon: "🔄", short: "Recovery" },
  learning_contribution: { icon: "🧠➡️📚", short: "Learn" },
};

const TIER_COLOUR: Record<FacetProof["tier"], string> = {
  CLAIMED:              TOKEN.claimed,
  RUNTIME_VERIFIED:     TOKEN.runtime,
  PRODUCTION_VERIFIED:  TOKEN.prod,
  NOT_APPLICABLE:       TOKEN.na,
};

export default function HqProofCardsPage() {
  const [snapshot, setSnapshot] = useState<ProofResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLane, setSelectedLane] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/nex/hq/agents/proof", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ProofResponse;
      setSnapshot(data);
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

  const agents = snapshot?.agents ?? [];
  const lanes = Array.from(new Set(agents.map((a) => a.lane))).sort();
  const filtered = selectedLane === "all" ? agents : agents.filter((a) => a.lane === selectedLane);

  // Summary stats
  const totalAgents = agents.length;
  const withIdentity = agents.filter((a) => a.identity !== null).length;
  const totalHeartbeats24h = agents.reduce((s, a) => s + a.signed_heartbeats_24h, 0);
  const totalPerf24h = agents.reduce((s, a) => s + a.performance_records_24h, 0);
  const totalLearn24h = agents.reduce((s, a) => s + a.learning_contributions_24h, 0);
  const facetTiers = { CLAIMED: 0, RUNTIME_VERIFIED: 0, PRODUCTION_VERIFIED: 0, NOT_APPLICABLE: 0 };
  for (const a of agents) for (const f of a.facets) facetTiers[f.tier]++;

  return (
    <div style={{ minHeight: "100vh", background: TOKEN.bg, padding: 24, color: TOKEN.text, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28 }}>NEX Agent Proof Cards</h1>
              <p style={{ margin: "4px 0 0", color: TOKEN.textMid, fontSize: 14 }}>
                Founder-locked · NO EVIDENCE = NO CLAIM · every value backed by a real GB record
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: TOKEN.textSoft }}>
              {loading ? "Loading…" : snapshot ? `Snapshot: ${new Date(snapshot.generated_at).toLocaleTimeString()}` : ""}
              {error && <span style={{ color: TOKEN.danger }}>Error: {error}</span>}
              <Link href="/nex-head-quarters/agents" style={{ color: TOKEN.accent }}>Standard view</Link>
              <Link href="/nex-head-quarters" style={{ color: TOKEN.accent }}>← HQ</Link>
            </div>
          </div>
        </header>

        {/* Summary strip */}
        <div style={{ marginBottom: 16, padding: 12, background: TOKEN.card, border: `1px solid ${TOKEN.border}`, borderRadius: 10, display: "flex", flexWrap: "wrap", gap: 20, fontSize: 13 }}>
          <div><strong>{totalAgents}</strong> agents</div>
          <div><strong>{withIdentity}/{totalAgents}</strong> provisioned identities</div>
          <div><strong>{totalHeartbeats24h}</strong> signed heartbeats 24h</div>
          <div><strong>{totalPerf24h}</strong> missions completed 24h</div>
          <div><strong>{totalLearn24h}</strong> learning contributions 24h</div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ color: TIER_COLOUR.RUNTIME_VERIFIED }}>▉ {facetTiers.RUNTIME_VERIFIED} runtime-verified</span>
            <span style={{ color: TIER_COLOUR.PRODUCTION_VERIFIED }}>▉ {facetTiers.PRODUCTION_VERIFIED} production-verified</span>
            <span style={{ color: TIER_COLOUR.CLAIMED }}>▉ {facetTiers.CLAIMED} claimed</span>
            <span style={{ color: TIER_COLOUR.NOT_APPLICABLE }}>▉ {facetTiers.NOT_APPLICABLE} n/a</span>
          </div>
        </div>

        {/* Lane filter */}
        <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <LaneChip label="all" active={selectedLane === "all"} onClick={() => setSelectedLane("all")} count={agents.length} />
          {lanes.map((lane) => (
            <LaneChip key={lane} label={lane} active={selectedLane === lane} onClick={() => setSelectedLane(lane)} count={agents.filter((a) => a.lane === lane).length} />
          ))}
        </div>

        {/* Cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 14 }}>
          {filtered.map((card) => <ProofCardView key={card.agent_id} card={card} />)}
        </div>

        <footer style={{ marginTop: 40, padding: 12, fontSize: 12, color: TOKEN.textSoft, borderTop: `1px solid ${TOKEN.divider}` }}>
          Every counter on every card is a live query against GB storage. Facet tiers: CLAIMED (code exists · not verified) · RUNTIME_VERIFIED (adversarial tests pass) · PRODUCTION_VERIFIED (real-mission observation). NOT_APPLICABLE means the facet is not required for this agent's role.
        </footer>
      </div>
    </div>
  );
}

function LaneChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }): React.ReactElement {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px", borderRadius: 16,
        border: `1px solid ${active ? TOKEN.accent : TOKEN.border}`,
        background: active ? TOKEN.accent : TOKEN.card,
        color: active ? "#fff" : TOKEN.text,
        cursor: "pointer", fontSize: 12,
      }}
    >
      {label} · {count}
    </button>
  );
}

function ProofCardView({ card }: { card: ProofCard }): React.ReactElement {
  return (
    <div style={{ background: TOKEN.card, border: `1px solid ${TOKEN.border}`, borderRadius: 12, padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{card.agent_name}</h3>
          <div style={{ fontSize: 11, color: TOKEN.textSoft, marginTop: 2 }}>
            {card.agent_id} · {card.lane}
          </div>
        </div>
        <div style={{ fontSize: 10, color: TOKEN.textSoft, textAlign: "right" }}>
          {card.identity ? (
            <div>runtime v{card.identity.runtime_version}</div>
          ) : (
            <div style={{ color: TOKEN.danger }}>NOT PROVISIONED</div>
          )}
        </div>
      </div>

      {/* Identity row */}
      {card.identity && (
        <div style={{ marginBottom: 10, padding: 8, background: "#f8f5ef", borderRadius: 8, fontSize: 11, color: TOKEN.textMid, fontFamily: "ui-monospace, monospace" }}>
          <div>🪪 {card.identity.identity_id.slice(-24)}</div>
          <div>🔑 {card.identity.runtime_key_public_hex_prefix}…</div>
          <div>⏱ spawned {new Date(card.identity.spawned_at).toLocaleTimeString()}</div>
        </div>
      )}

      {/* 15-facet grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginBottom: 10 }}>
        {card.facets.map((f) => (
          <div key={f.facet} title={`${f.facet} · ${f.tier} · ${f.evidence_count_24h} 24h`}
               style={{
                 padding: "6px 8px", borderRadius: 6,
                 background: TIER_COLOUR[f.tier] + "18",
                 border: `1px solid ${TIER_COLOUR[f.tier]}55`,
                 fontSize: 10, color: TOKEN.textMid,
                 display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4,
               }}>
            <span>{FACET_LABEL[f.facet]?.icon ?? "•"} {FACET_LABEL[f.facet]?.short ?? f.facet}</span>
            <span style={{ fontFamily: "ui-monospace, monospace", color: TIER_COLOUR[f.tier], fontWeight: 600 }}>{f.evidence_count_24h}</span>
          </div>
        ))}
      </div>

      {/* Real 24h counters */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12, marginBottom: 8 }}>
        <div><strong>❤️ Heartbeats 24h:</strong> {card.signed_heartbeats_24h}</div>
        <div><strong>❤️ Heartbeats ever:</strong> {card.signed_heartbeats_ever}</div>
        <div><strong>🗃️ Memory records:</strong> {card.memory_records}</div>
        <div><strong>📈 Missions 24h:</strong> {card.performance_records_24h}</div>
        <div><strong>🧠➡️📚 Learn 24h:</strong> {card.learning_contributions_24h}</div>
        <div><strong>⏱ Last HB:</strong> {card.latest_heartbeat_emitted_at ? new Date(card.latest_heartbeat_emitted_at).toLocaleTimeString() : "—"}</div>
      </div>

      {/* Evidence pointer */}
      {card.latest_evidence_ref && (
        <div style={{ padding: 6, background: "#f8f5ef", borderRadius: 6, fontSize: 10, fontFamily: "ui-monospace, monospace", color: TOKEN.textMid, marginBottom: 8 }}>
          🧾 latest evidence: {card.latest_evidence_ref}
        </div>
      )}

      {/* Authority boundary */}
      {card.authority && (
        <details style={{ fontSize: 11, color: TOKEN.textMid }}>
          <summary style={{ cursor: "pointer", color: TOKEN.text }}>🔐 Authority boundary</summary>
          <div style={{ marginTop: 6, padding: 6, background: "#f8f5ef", borderRadius: 6, fontFamily: "ui-monospace, monospace" }}>
            <div><strong>tools:</strong> {card.authority.authorised_tools.join(", ") || "—"}</div>
            <div><strong>hosts:</strong> {card.authority.authorised_hosts.join(", ") || "—"}</div>
            <div><strong>prohibited:</strong> {card.authority.prohibited_actions.join(", ") || "—"}</div>
          </div>
        </details>
      )}
    </div>
  );
}
