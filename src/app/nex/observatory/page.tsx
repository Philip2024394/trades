// src/app/nex/observatory/page.tsx
//
// Founder Path A · OBS-3 · Observatory HTML dashboard.
//
// Reads /api/nex/observatory/snapshot and renders:
//   · Doctrine Health card (overall_score · target 1.0)
//   · Groundedness card (Gate v2 alignment percentiles · postrationalisation rate)
//   · Latency + Promotion Path card (P50/P95 · path ratios · Composition Pilot target < 5% LLM)
//   · Domain Coverage table
//   · Alerts panel (prominent when critical)
//   · Window selector (1h · 24h · 7d · 30d)
//   · Manual refresh button
//
// Zero fabrication: every number rendered is real, straight from the
// Observatory Brain read-only snapshot. No simulation. No mocks.

"use client";

import { useCallback, useEffect, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Snapshot = any;
type WindowPreset = "1h" | "24h" | "7d" | "30d";

export default function ObservatoryPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [window, setWindow] = useState<WindowPreset>("24h");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/nex/observatory/snapshot?window=${window}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setSnapshot(json);
      setLastFetch(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => { void load(); }, [load]);

  const doctrine = snapshot?.doctrine_health;
  const grounded = snapshot?.groundedness;
  const latency = snapshot?.latency;
  const coverage: Array<Record<string, unknown>> = snapshot?.domain_coverage ?? [];
  const domainGaps: Array<{
    domain: string; open_gap_count: number; oldest_open_age_days?: number;
    top_gaps: Array<{ entity_ref: string; intent_slug: string; times_seen: number; first_seen_at: string; last_seen_at: string; source: string }>;
  }> = snapshot?.domain_gaps ?? [];
  const alerts: Array<{ severity: string; category: string; message: string }> = snapshot?.alerts ?? [];

  const doctrineOk = doctrine?.overall_score === 1;
  const llmDisciplineOk = (latency?.llm_invoked_ratio ?? 0) < 0.05;
  const postratOk = (grounded?.postrationalisation_rate ?? 0) < 0.05;

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, letterSpacing: "-0.01em" }}>NEX Observatory</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.65 }}>
            Live doctrine health · groundedness · composition-first discipline · zero fabrication invariant
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, opacity: 0.7 }}>Window</label>
          <select value={window} onChange={(e) => setWindow(e.target.value as WindowPreset)} style={selectStyle}>
            <option value="1h">1 h</option>
            <option value="24h">24 h</option>
            <option value="7d">7 d</option>
            <option value="30d">30 d</option>
          </select>
          <button onClick={() => void load()} style={buttonStyle} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div style={{ ...cardStyle, borderColor: "#b91c1c", background: "#fef2f2" }}>
          <strong>Snapshot error:</strong> {error}
        </div>
      )}

      {snapshot && (
        <>
          {/* Alerts panel */}
          {alerts.length > 0 ? (
            <section style={{ ...cardStyle, borderColor: "#f59e0b", background: "#fffbeb" }}>
              <h2 style={sectionTitleStyle}>Alerts ({alerts.length})</h2>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {alerts.map((a, i) => (
                  <li key={i} style={{ marginTop: 4, fontSize: 13 }}>
                    <span style={{ ...pillStyle, background: a.severity === "critical" ? "#dc2626" : "#f59e0b" }}>
                      {a.severity}
                    </span>
                    {" "}<strong>{a.category}</strong>{" — "}{a.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section style={{ ...cardStyle, borderColor: "#10b981", background: "#ecfdf5" }}>
              <strong>All clear</strong> · no active alerts in this window.
            </section>
          )}

          <div style={gridStyle}>
            {/* Doctrine health */}
            <section style={{ ...cardStyle, borderColor: doctrineOk ? "#10b981" : "#b91c1c" }}>
              <h2 style={sectionTitleStyle}>Doctrine Health</h2>
              <div style={bigNumberStyle}>{doctrine?.overall_score?.toFixed?.(3) ?? "—"}</div>
              <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 12 }}>
                Target 1.000 · zero bypass · {doctrineOk ? "green" : "attention required"}
              </div>
              <dl style={dlStyle}>
                <dt>#1 · Truth Engine gate rejections</dt>
                <dd>
                  orphan {doctrine?.doctrine_1_gate_rejections?.orphan_citations ?? 0} ·
                  postrat {doctrine?.doctrine_1_gate_rejections?.postrationalisation_suspected ?? 0} ·
                  memory (also #4) {doctrine?.doctrine_1_gate_rejections?.memory_citations_reject ?? 0}
                </dd>
                <dt>#2 · Action authorization</dt>
                <dd>
                  proposed {doctrine?.doctrine_2_action_rejections?.total_proposed ?? 0} ·
                  executed {doctrine?.doctrine_2_action_rejections?.executed ?? 0} ·
                  rejected {(doctrine?.doctrine_2_action_rejections?.rejected_schema ?? 0)
                          + (doctrine?.doctrine_2_action_rejections?.rejected_unknown_action ?? 0)
                          + (doctrine?.doctrine_2_action_rejections?.rejected_permission ?? 0)
                          + (doctrine?.doctrine_2_action_rejections?.rejected_guardrail ?? 0)}
                </dd>
                <dt>#3 · Trust-cap violations</dt>
                <dd>{doctrine?.doctrine_3_trust_cap_violations ?? 0} <span style={{ opacity: 0.5 }}>(architecturally impossible when gate is correct)</span></dd>
                <dt>#4 · Memory citation attempts</dt>
                <dd>{doctrine?.doctrine_4_memory_citation_attempts ?? 0}</dd>
              </dl>
            </section>

            {/* Groundedness */}
            <section style={{ ...cardStyle, borderColor: postratOk ? "#10b981" : "#f59e0b" }}>
              <h2 style={sectionTitleStyle}>Groundedness (Gate v2)</h2>
              <div style={bigNumberStyle}>{(grounded?.postrationalisation_rate ?? 0).toFixed?.(3)}</div>
              <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 12 }}>
                Postrationalisation rate · target &lt; 0.05
              </div>
              <dl style={dlStyle}>
                <dt>Verified replies</dt><dd>{grounded?.verified_replies ?? 0}</dd>
                <dt>Unverified (honest UNKNOWN)</dt><dd>{grounded?.unverified_replies ?? 0}</dd>
                <dt>Alignment min / p50 / p95 / max</dt>
                <dd>
                  {(grounded?.alignment_min ?? 0).toFixed?.(3)} ·
                  {(grounded?.alignment_p50 ?? 0).toFixed?.(3)} ·
                  {(grounded?.alignment_p95 ?? 0).toFixed?.(3)} ·
                  {(grounded?.alignment_max ?? 0).toFixed?.(3)}
                </dd>
              </dl>
            </section>

            {/* Latency + promotion path */}
            <section style={{ ...cardStyle, borderColor: llmDisciplineOk ? "#10b981" : "#f59e0b" }}>
              <h2 style={sectionTitleStyle}>Latency + Promotion Path</h2>
              <div style={bigNumberStyle}>{(latency?.llm_invoked_ratio ?? 0).toFixed?.(3)}</div>
              <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 12 }}>
                LLM invocation ratio · Composition Pilot target &lt; 0.05
              </div>
              <dl style={dlStyle}>
                <dt>Adapter promoted</dt><dd>{fmtRatio(latency?.adapter_promoted_ratio)}</dd>
                <dt>Composer accepted</dt><dd>{fmtRatio(latency?.composer_accepted_ratio)}</dd>
                <dt>Rescue fired</dt><dd>{fmtRatio(latency?.rescue_fired_ratio)}</dd>
                <dt>Research fired</dt><dd>{fmtRatio(latency?.research_fired_ratio)}</dd>
                <dt>End-to-end p50 / p95</dt>
                <dd>{latency?.end_to_end_p50_ms ?? "—"} ms · {latency?.end_to_end_p95_ms ?? "—"} ms</dd>
                <dt>Per-stage p50</dt>
                <dd>
                  adapter {latency?.adapter_p50_ms ?? "—"} ·
                  composer {latency?.composer_p50_ms ?? "—"} ·
                  rescue {latency?.rescue_p50_ms ?? "—"} ·
                  research {latency?.research_p50_ms ?? "—"}
                </dd>
              </dl>
            </section>
          </div>

          {/* Domain coverage */}
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Domain Coverage</h2>
            {coverage.length === 0 ? (
              <div style={{ opacity: 0.6, fontSize: 13 }}>No question_variant data yet in this window.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", opacity: 0.65 }}>
                    <th>Domain</th><th>Answered</th><th>Partial</th><th>Unknown</th><th>Coverage</th><th>Open gaps</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "6px 0" }}>{String(r.domain)}</td>
                      <td>{String(r.answered_question_variants ?? 0)}</td>
                      <td>{String(r.partially_answered ?? 0)}</td>
                      <td>{String(r.unknown ?? 0)}</td>
                      <td>{fmtRatio(r.coverage_ratio as number)}</td>
                      <td>{String(r.open_gap_count ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Domain gap drill-down · OBS-4 */}
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Open Knowledge Gaps · per domain</h2>
            {domainGaps.length === 0 ? (
              <div style={{ opacity: 0.6, fontSize: 13 }}>No open gaps in nex.knowledge_gap yet.</div>
            ) : (
              domainGaps.map((d) => (
                <details key={d.domain} style={{ marginTop: 10, fontSize: 13 }} open={d.open_gap_count > 0}>
                  <summary style={{ cursor: "pointer", padding: "6px 0", fontWeight: 600 }}>
                    {d.domain}
                    <span style={{ marginLeft: 8, opacity: 0.7, fontWeight: 400 }}>
                      · {d.open_gap_count} open
                      {typeof d.oldest_open_age_days === "number" ? ` · oldest ${d.oldest_open_age_days.toFixed(1)} d` : ""}
                    </span>
                  </summary>
                  {d.top_gaps.length === 0 ? (
                    <div style={{ opacity: 0.6, fontSize: 12, padding: "6px 0" }}>No specific gap rows.</div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 4 }}>
                      <thead>
                        <tr style={{ textAlign: "left", opacity: 0.65 }}>
                          <th>Entity</th><th>Intent</th><th>Times seen</th><th>Source</th><th>Last seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.top_gaps.map((g, i) => (
                          <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "4px 8px 4px 0" }}>{g.entity_ref}</td>
                            <td>{g.intent_slug}</td>
                            <td>{g.times_seen}</td>
                            <td style={{ opacity: 0.7 }}>{g.source}</td>
                            <td style={{ opacity: 0.7 }}>{new Date(g.last_seen_at).toISOString().slice(0, 16).replace("T", " ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </details>
              ))
            )}
          </section>

          <footer style={{ marginTop: 24, fontSize: 11, opacity: 0.5 }}>
            data-observatory-page = "true" ·
            Window {snapshot?.window?.preset} · emitted {snapshot?.emitted_at} · fetched {lastFetch}
          </footer>
        </>
      )}
    </div>
  );
}

function fmtRatio(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(3);
}

const pageStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  padding: "20px 28px",
  maxWidth: 1200,
  margin: "0 auto",
  color: "#0f172a",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: "1px solid #e5e7eb",
};
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 12,
  marginTop: 12,
};
const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 14,
  background: "#fff",
  marginTop: 12,
};
const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: "-0.005em" };
const bigNumberStyle: React.CSSProperties = { fontSize: 30, fontWeight: 700, marginTop: 6, marginBottom: 0 };
const dlStyle: React.CSSProperties = { margin: 0, fontSize: 12, display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 6, columnGap: 8 };
const buttonStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  fontSize: 13,
  cursor: "pointer",
};
const selectStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 13,
};
const pillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  borderRadius: 4,
  color: "#fff",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
