// M4 · Blind user test results dashboard
// 5-dimensional read on how NEX performed with real participants.
// Green/Amber/Red per dimension using Philip's 2026-08-15 thresholds
// (see data/nex-conv/plans/M4-TEST-PROTOCOL-2026-08-15.md).
// Live dropped-in dimensional aggregates + individual-submission drilldown.

"use client";

import { useEffect, useState } from "react";

type NPS = { score: number | null; promoters: number; passives: number; detractors: number; n: number };

type Aggregate = {
  n_submissions: number;
  dimension_1_ai_detection: {
    thought_person: number; thought_ai: number; thought_both: number; thought_unsure: number;
    mean_confidence: number | null;
    correctly_identified_ai_high_confidence_pct: number;
  };
  dimension_2_usefulness: {
    mean_helped: number | null;
    outcome_yes_pct: number; outcome_partial_pct: number; outcome_no_pct: number;
    would_use_again_yes_or_maybe_pct: number;
  };
  dimension_3_correctness_trust: {
    mean_trust: number | null;
    wrong_reported_pct: number;
  };
  dimension_4_conversation_quality: {
    mean_understood: number | null;
    repeated_pct: number; misunderstood_pct: number; frustrated_pct: number;
  };
  dimension_5_business_outcome: {
    nps: NPS;
    would_enquire_yes_or_maybe_pct: number;
  };
  submissions: Array<{
    conversation_id: string;
    outcome: string;
    labelled_at: string;
    responses: Record<string, unknown>;
    participant: { age_band: string | null; tech_comfort: string | null };
  }>;
};

export default function M4ResultsPage() {
  const [data, setData] = useState<Aggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/nex-conv/survey")
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={pageStyle}><p>Loading…</p></div>;
  if (error) return <div style={pageStyle}><p style={{ color: "#e07070" }}>Error: {error}</p></div>;
  if (!data) return <div style={pageStyle}><p>No data yet.</p></div>;

  const target = 12; // Philip's low-end target
  const progress = Math.min(100, Math.round((data.n_submissions / target) * 100));

  // Dimension traffic-light logic per protocol thresholds
  const d1 = data.dimension_1_ai_detection;
  const d2 = data.dimension_2_usefulness;
  const d3 = data.dimension_3_correctness_trust;
  const d4 = data.dimension_4_conversation_quality;
  const d5 = data.dimension_5_business_outcome;

  const meanUseful = (d2.mean_helped ?? 0);
  const meanTrust = (d3.mean_trust ?? 0);
  const meanUnderstood = (d4.mean_understood ?? 0);
  const npsScore = d5.nps.score ?? 0;

  const lights = {
    // For dimension 1, "green" is loose because AI-detection alone doesn't verdict.
    // We flag only if a majority correctly IDs AI at high confidence.
    d1: d1.correctly_identified_ai_high_confidence_pct <= 30 ? 'green' : d1.correctly_identified_ai_high_confidence_pct <= 60 ? 'amber' : 'red',
    d2: meanUseful >= 4 && (d2.outcome_yes_pct + d2.outcome_partial_pct) >= 70 && d2.would_use_again_yes_or_maybe_pct >= 60 ? 'green'
      : meanUseful >= 3 && (d2.outcome_yes_pct + d2.outcome_partial_pct) >= 50 ? 'amber' : 'red',
    d3: meanTrust >= 4 && d3.wrong_reported_pct <= 20 ? 'green'
      : meanTrust >= 3 && d3.wrong_reported_pct <= 40 ? 'amber' : 'red',
    d4: meanUnderstood >= 4 && d4.repeated_pct <= 30 && d4.misunderstood_pct <= 30 && d4.frustrated_pct <= 30 ? 'green'
      : meanUnderstood >= 3 && d4.repeated_pct <= 50 && d4.misunderstood_pct <= 50 && d4.frustrated_pct <= 50 ? 'amber' : 'red',
    d5: npsScore >= 20 && d5.would_enquire_yes_or_maybe_pct >= 60 ? 'green'
      : npsScore >= 0 && d5.would_enquire_yes_or_maybe_pct >= 40 ? 'amber' : 'red',
  } as const;

  const overall = Object.values(lights).every(l => l === 'green') ? 'M4 PASS'
    : Object.values(lights).some(l => l === 'red') ? 'RED · action required'
    : 'AMBER · targeted fix';

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 28, margin: 0, fontWeight: 600 }}>M4 · Blind user test · results</h1>
            <p style={{ color: "#a79c8e", fontSize: 14, marginTop: 6 }}>
              5 dimensions · equal weight · targets from Philip's 2026-08-15 protocol.
            </p>
          </div>
          <a href="/nex-app/nex-brain/conversations" style={{ padding: "8px 16px", background: "transparent", color: "#a79c8e", border: "1px solid #2a2620", borderRadius: 4, textDecoration: "none", fontSize: 13 }}>← Conversations</a>
        </header>

        {/* Progress + overall */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ padding: 16, background: "#161310", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "#a79c8e", marginBottom: 8 }}>Progress · {data.n_submissions}/{target}+ target</div>
            <div style={{ height: 8, background: "#2a2620", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: progress >= 100 ? "#7fd4a8" : "#dbb17a", transition: "width .3s" }} />
            </div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>
              Aggregate stats stabilise around 12+ submissions.
            </div>
          </div>
          <div style={{ padding: 16, background: overallBg(overall), borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#0f0d0a", opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.5 }}>overall</div>
            <div style={{ fontSize: 20, color: "#0f0d0a", fontWeight: 600, marginTop: 6 }}>{overall}</div>
          </div>
        </div>

        {/* 5 dimensions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 16, marginBottom: 32 }}>
          <DimCard light={lights.d1} num={1} title="AI detection" note="the verdict here is not solo · other dimensions matter equally">
            <Metric label="thought person" value={`${d1.thought_person}%`} />
            <Metric label="thought AI" value={`${d1.thought_ai}%`} />
            <Metric label="thought mix / unsure" value={`${d1.thought_both + d1.thought_unsure}%`} />
            <Metric label="mean confidence" value={d1.mean_confidence ?? "—"} />
            <Metric label="correctly ID'd AI (conf ≥4)" value={`${d1.correctly_identified_ai_high_confidence_pct}%`} highlight={lights.d1 !== 'green'} />
          </DimCard>

          <DimCard light={lights.d2} num={2} title="Usefulness" note="did the conversation actually help">
            <Metric label="mean 'helped understand'" value={d2.mean_helped ?? "—"} />
            <Metric label="useful outcome (yes / partial / no)" value={`${d2.outcome_yes_pct}% / ${d2.outcome_partial_pct}% / ${d2.outcome_no_pct}%`} />
            <Metric label="would use again (yes+maybe)" value={`${d2.would_use_again_yes_or_maybe_pct}%`} />
          </DimCard>

          <DimCard light={lights.d3} num={3} title="Correctness / trust" note="did they trust the answers · were there factual errors">
            <Metric label="mean trust" value={d3.mean_trust ?? "—"} />
            <Metric label="reported something wrong" value={`${d3.wrong_reported_pct}%`} highlight={lights.d3 !== 'green'} />
          </DimCard>

          <DimCard light={lights.d4} num={4} title="Conversation quality" note="how did it feel to talk to">
            <Metric label="mean 'understood me'" value={d4.mean_understood ?? "—"} />
            <Metric label="felt repetitive" value={`${d4.repeated_pct}%`} highlight={d4.repeated_pct > 30} />
            <Metric label="misunderstood them" value={`${d4.misunderstood_pct}%`} highlight={d4.misunderstood_pct > 30} />
            <Metric label="felt frustrated" value={`${d4.frustrated_pct}%`} highlight={d4.frustrated_pct > 30} />
          </DimCard>

          <DimCard light={lights.d5} num={5} title="Business outcome" note="would this convert to a real Summit enquiry">
            <Metric label="NPS" value={d5.nps.score === null ? "—" : (d5.nps.score >= 0 ? `+${d5.nps.score}` : `${d5.nps.score}`)} highlight={lights.d5 !== 'green'} />
            <Metric label="promoters / passives / detractors" value={`${d5.nps.promoters} / ${d5.nps.passives} / ${d5.nps.detractors}`} />
            <Metric label="would enquire (yes+maybe)" value={`${d5.would_enquire_yes_or_maybe_pct}%`} />
          </DimCard>
        </div>

        {/* Submissions table · drill-down */}
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: "#a79c8e", marginBottom: 12 }}>Individual submissions ({data.submissions.length})</h2>
          {data.submissions.length === 0 && (
            <div style={{ padding: 32, background: "#1e1a15", borderRadius: 8, color: "#a79c8e", textAlign: "center" }}>
              No submissions yet. Point participants at <code>/nex-app/nex-brain/m4-survey/&lt;conversation_id&gt;</code> after their chat.
            </div>
          )}
          {data.submissions.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "#a79c8e", textAlign: "left", borderBottom: "1px solid #2a2620" }}>
                  <th style={th}>convo</th>
                  <th style={th}>when</th>
                  <th style={th}>who</th>
                  <th style={th}>thought</th>
                  <th style={th}>helped</th>
                  <th style={th}>trust</th>
                  <th style={th}>understood</th>
                  <th style={th}>NPS</th>
                  <th style={th}>enquire</th>
                </tr>
              </thead>
              <tbody>
                {data.submissions.map(s => (
                  <tr key={s.conversation_id} style={{ borderBottom: "1px solid #1e1a15" }}>
                    <td style={td}><code style={{ fontSize: 10, color: "#8e8577" }}>{s.conversation_id.slice(0, 8)}…</code></td>
                    <td style={td}>{new Date(s.labelled_at).toLocaleString()}</td>
                    <td style={td}>{s.participant?.age_band ?? "—"} · {s.participant?.tech_comfort ?? "—"}</td>
                    <td style={td}>{(s.responses.q1_thought as string) ?? "—"}</td>
                    <td style={td}>{(s.responses.q4_helped as number) ?? "—"}/5</td>
                    <td style={td}>{(s.responses.q7_trust as number) ?? "—"}/5</td>
                    <td style={td}>{(s.responses.q9_understood as number) ?? "—"}/5</td>
                    <td style={td}>{(s.responses.q13_nps as number) ?? "—"}</td>
                    <td style={td}>{(s.responses.q14_would_enquire as string) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = { padding: "32px 24px 80px", fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif", background: "#0f0d0a", color: "#e6dfd1", minHeight: "100vh" };
const th: React.CSSProperties = { padding: "8px 12px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "10px 12px" };

function overallBg(overall: string): string {
  if (overall.startsWith("M4 PASS")) return "#7fd4a8";
  if (overall.startsWith("RED")) return "#e07070";
  return "#dbb17a";
}

function DimCard({ light, num, title, note, children }: { light: 'green' | 'amber' | 'red'; num: number; title: string; note: string; children: React.ReactNode }) {
  const border = light === 'green' ? '#2a5a3a' : light === 'amber' ? '#5a4a2a' : '#5a2a2a';
  const chip = light === 'green' ? '#7fd4a8' : light === 'amber' ? '#dbb17a' : '#e07070';
  return (
    <div style={{ padding: 16, background: "#161310", borderRadius: 8, border: `1px solid ${border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "#e6dfd1" }}><span style={{ color: "#a79c8e", marginRight: 8 }}>{num}</span>{title}</h3>
        <span style={{ padding: "2px 10px", background: chip, color: "#0f0d0a", borderRadius: 999, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{light}</span>
      </div>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 12 }}>{note}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span style={{ color: "#a79c8e" }}>{label}</span>
      <span style={{ color: highlight ? "#dbb17a" : "#e6dfd1", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
