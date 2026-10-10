// WO-HQ-THREE-METRIC-01 · founder-locked three-metric view.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const TOKEN = {
  bg: "#faf7f2", card: "#ffffff", border: "#e6e2d9",
  text: "#1f1d18", textSoft: "#8a8477", textMid: "#57534a",
  accent: "#c2803b", success: "#10b981", warning: "#f59e0b", danger: "#dc2626", info: "#3b82f6",
};

interface DrilldownMetric {
  count: number;
  source_collection: string;
  sample_record_ids: string[];
}

interface ThreeMetricGrowth {
  record_type: string;
  generated_at: string;
  language_note: string;
  processing_growth: {
    sources: DrilldownMetric;
    source_entries: DrilldownMetric;
    sanitized_fragments: DrilldownMetric;
    discoveries: DrilldownMetric;
    hypotheses: DrilldownMetric;
    experiments: DrilldownMetric;
    total_processing_records: number;
  };
  validated_knowledge_growth: {
    validated_knowledge_objects: DrilldownMetric;
    proposals: DrilldownMetric;
    total_validated_records: number;
  };
  capability_growth: {
    caps_resolved: DrilldownMetric;
    caps_open: DrilldownMetric;
    caps_escalated: DrilldownMetric;
    caps_proposed: DrilldownMetric;
    net_capability_improvement: number;
    recent_resolutions: {
      cap_id: string;
      cap_title: string;
      cap_kind: string;
      cap_category: string;
      execution_attempt_id: string;
      workstation_trace_id: string;
      environment: string;
      resolved_at: string;
      evidence_verified: boolean;
      causal_chain: string[];
    }[];
  };
}

export default function ThreeMetricGrowthPage() {
  const [snap, setSnap] = useState<ThreeMetricGrowth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/nex/hq/three-metric-growth", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSnap((await res.json()) as ThreeMetricGrowth);
      setError(null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div style={{ minHeight: "100vh", background: TOKEN.bg, padding: 24, color: TOKEN.text, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <header style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26 }}>NEX Growth · Three Metrics</h1>
            <p style={{ margin: "4px 0 0", color: TOKEN.textMid, fontSize: 13 }}>Processing volume ≠ Validated knowledge ≠ Capability growth · founder-locked</p>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 13, color: TOKEN.textSoft }}>
            {loading ? "…" : snap ? `Snapshot: ${new Date(snap.generated_at).toLocaleTimeString()}` : ""}
            {error && <span style={{ color: TOKEN.danger }}>{error}</span>}
            <Link href="/nex-head-quarters" style={{ color: TOKEN.accent }}>← HQ</Link>
          </div>
        </header>

        {snap && (
          <div style={{ marginBottom: 16, padding: 12, background: TOKEN.card, border: `1px solid ${TOKEN.border}`, borderRadius: 10, fontSize: 12, color: TOKEN.textMid }}>
            📜 <strong>Language discipline:</strong> {snap.language_note}
          </div>
        )}

        {snap && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
            {/* METRIC 1: Processing growth */}
            <MetricCard
              title="1 · Processing Growth"
              subtitle="Pipeline volume · activity · NOT the same as intelligence growth"
              headline={snap.processing_growth.total_processing_records}
              headlineLabel="pipeline records"
              colour={TOKEN.info}
              rows={[
                ["🌐 Sources", snap.processing_growth.sources.count, snap.processing_growth.sources.sample_record_ids[0]],
                ["📄 Source entries", snap.processing_growth.source_entries.count, snap.processing_growth.source_entries.sample_record_ids[0]],
                ["🧹 Sanitized", snap.processing_growth.sanitized_fragments.count, snap.processing_growth.sanitized_fragments.sample_record_ids[0]],
                ["🔍 Discoveries", snap.processing_growth.discoveries.count, snap.processing_growth.discoveries.sample_record_ids[0]],
                ["💡 Hypotheses", snap.processing_growth.hypotheses.count, snap.processing_growth.hypotheses.sample_record_ids[0]],
                ["🧪 Experiments", snap.processing_growth.experiments.count, snap.processing_growth.experiments.sample_record_ids[0]],
              ]}
            />

            {/* METRIC 2: Validated knowledge growth */}
            <MetricCard
              title="2 · Validated Knowledge Growth"
              subtitle="Passed causal-chain verification · Scoring-promoted only"
              headline={snap.validated_knowledge_growth.total_validated_records}
              headlineLabel="validated records"
              colour={TOKEN.success}
              rows={[
                ["✅ Validated KOs", snap.validated_knowledge_growth.validated_knowledge_objects.count, snap.validated_knowledge_growth.validated_knowledge_objects.sample_record_ids[0]],
                ["📮 Proposals", snap.validated_knowledge_growth.proposals.count, snap.validated_knowledge_growth.proposals.sample_record_ids[0]],
              ]}
            />

            {/* METRIC 3: Capability growth (the important long-term metric) */}
            <MetricCard
              title="3 · Capability Growth"
              subtitle="⭐ The long-term important metric · CAP-RESOLVED events (NEX genuinely improved)"
              headline={snap.capability_growth.net_capability_improvement}
              headlineLabel="CAPs resolved"
              colour={TOKEN.accent}
              highlight
              rows={[
                ["✅ CAPs RESOLVED", snap.capability_growth.caps_resolved.count, snap.capability_growth.caps_resolved.sample_record_ids[0]],
                ["📋 CAPs OPEN", snap.capability_growth.caps_open.count, snap.capability_growth.caps_open.sample_record_ids[0]],
                ["📝 CAPs PROPOSED", snap.capability_growth.caps_proposed.count, snap.capability_growth.caps_proposed.sample_record_ids[0]],
                ["🚨 CAPs ESCALATED", snap.capability_growth.caps_escalated.count, snap.capability_growth.caps_escalated.sample_record_ids[0]],
              ]}
            />
          </div>
        )}

        {/* Founder-locked display discipline · never bare "+1" · every increment has evidence */}
        {snap && snap.capability_growth.recent_resolutions.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 18, margin: "0 0 12px", color: TOKEN.textMid }}>Recent Capability Resolutions</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {snap.capability_growth.recent_resolutions.map((r) => (
                <div key={r.cap_id} style={{ background: TOKEN.card, border: `1px solid ${TOKEN.border}`, borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: TOKEN.accent }}>+1</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {r.cap_id} resolved · {r.evidence_verified ? "Evidence verified ✅" : "Evidence pending ⚠️"}
                      </div>
                      <div style={{ fontSize: 11, color: TOKEN.textSoft, marginTop: 2, fontFamily: "ui-monospace, monospace" }}>
                        {r.cap_kind} · {r.cap_category} · env={r.environment}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: TOKEN.textMid, textAlign: "right" }}>
                    <div>{new Date(r.resolved_at).toLocaleString()}</div>
                    {r.execution_attempt_id && (
                      <div style={{ fontFamily: "ui-monospace, monospace", marginTop: 2 }}>
                        attempt: {r.execution_attempt_id.slice(0, 24)}…
                      </div>
                    )}
                    <details style={{ marginTop: 2, cursor: "pointer" }}>
                      <summary style={{ color: TOKEN.accent, fontSize: 10 }}>causal chain ({r.causal_chain.length})</summary>
                      <ol style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 10, fontFamily: "ui-monospace, monospace", color: TOKEN.textSoft }}>
                        {r.causal_chain.map((c, i) => <li key={i}>{c}</li>)}
                      </ol>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div style={{ marginTop: 24, padding: 12, fontSize: 11, color: TOKEN.textSoft, borderTop: `1px solid ${TOKEN.border}` }}>
          Founder-locked doctrine: (1) Processing growth is activity, not intelligence. (2) Validated knowledge is causally-supported. (3) Capability growth measures whether NEX actually became better · this is the metric CAP + NEX1 Engineer feeds long-term. Every count above resolves to real record IDs (click through the drilldown record ID column).
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, subtitle, headline, headlineLabel, colour, rows, highlight }: {
  title: string; subtitle: string; headline: number; headlineLabel: string; colour: string;
  rows: Array<[string, number, string | undefined]>; highlight?: boolean;
}): React.ReactElement {
  return (
    <div style={{
      background: TOKEN.card,
      border: `${highlight ? 2 : 1}px solid ${highlight ? colour : TOKEN.border}`,
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colour }}>{title}</h3>
        <div style={{ fontSize: 11, color: TOKEN.textSoft, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ padding: "12px", background: colour + "10", borderRadius: 8, marginBottom: 12, textAlign: "center" }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: colour }}>{headline.toLocaleString()}</div>
        <div style={{ fontSize: 11, color: TOKEN.textMid, textTransform: "uppercase", letterSpacing: 0.5 }}>{headlineLabel}</div>
      </div>
      <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
        {rows.map(([label, count, sampleId]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: "#f8f5ef", borderRadius: 6 }}>
            <span>{label}</span>
            <span style={{ fontFamily: "ui-monospace, monospace" }}>
              <strong>{count}</strong>{sampleId ? ` · ${sampleId.slice(0, 20)}…` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
