"use client";

// src/app/nex-head-quarters/live-chat-completion/page.tsx
//
// Founder BEGIN Phase 3.6 · HQ dashboard for the Live Chat Completion stack.
//
// Consumes /api/nex/lcc/observatory. Shows:
//   - Per-category scorecard (entities · question_variants · answered · gaps
//     · coverage % · answered %)
//   - Worker health (heartbeat freshness · current task · state)
//   - Top open knowledge-gap intents (real customer demand · demand-sorted)
//   - Retrieval-level distribution (L1_exact vs L2 vs L3 last hour)
//   - Fact conflicts per domain (Truth Engine detections)
//
// Auto-refresh every 30s. No auth (dev-time surface). No fabrication ·
// every number is served from the observatory API which reads real tables.

import { useEffect, useMemo, useState } from "react";

interface Category {
  domain: string;
  entities: number;
  question_variants: number;
  candidate: number;
  answered: number;
  partially_answered: number;
  unknown: number;
  conflicting: number;
  stale: number;
  open_gaps: number;
  gap_demand_sum: number;
  question_variant_target: number;
  coverage_pct: number;
  answered_pct: number;
  avg_verify_ms: number | null;
}

interface Worker {
  worker_id: string;
  domain: string;
  worker_kind: string;
  reported_state: string;
  supervised_state: string;
  heartbeat_stale_ms: number;
  current_task: string | null;
  tasks_completed: number;
  tasks_failed: number;
  queue_depth: number;
  updated_at: string;
  last_error: string | null;
}

interface GapIntent { domain: string; intent_slug: string; gaps: number; demand: number; }

interface Observatory {
  generated_at: string;
  latency_ms: number;
  categories: Category[];
  workers: Worker[];
  top_gap_intents: GapIntent[];
  fact_conflicts_by_domain: Record<string, { open: number; total_seen: number }>;
  retrieval_by_level_last_hour: Record<string, { total: number; matched: number; avg_ms: number }>;
  instrument_version: string;
}

export default function LiveChatCompletionHqPage() {
  const [state, setState] = useState<{ data: Observatory | null; error: string | null; loading: boolean; last_fetch_at: string | null }>({
    data: null, error: null, loading: false, last_fetch_at: null,
  });

  async function refresh() {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/nex/lcc/observatory", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Observatory;
      setState({ data, error: null, loading: false, last_fetch_at: new Date().toISOString() });
    } catch (e) {
      setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e), loading: false }));
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, []);

  const nonEmptyCategories = useMemo(
    () => (state.data?.categories ?? []).filter((c) => c.entities > 0 || c.question_variants > 0),
    [state.data],
  );
  const emptyCategories = useMemo(
    () => (state.data?.categories ?? []).filter((c) => c.entities === 0 && c.question_variants === 0),
    [state.data],
  );

  return (
    <main style={{
      minHeight: "100vh", background: "#0b0f14", color: "#e5e7eb",
      fontFamily: "system-ui, -apple-system, sans-serif", padding: "24px",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>NEX · Live Chat Completion · HQ</h1>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {state.data ? `${state.data.instrument_version} · fetched ${state.data.latency_ms}ms` : "loading…"}
              {state.last_fetch_at ? ` · last ${new Date(state.last_fetch_at).toLocaleTimeString()}` : ""}
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={state.loading}
            style={{
              padding: "8px 14px", background: state.loading ? "#374151" : "#f59e0b",
              color: state.loading ? "#9ca3af" : "#000", border: "none", borderRadius: 8,
              fontWeight: 600, cursor: state.loading ? "wait" : "pointer",
            }}
          >{state.loading ? "…" : "refresh"}</button>
        </header>

        {state.error && (
          <div style={{ background: "#7f1d1d", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            error: {state.error}
          </div>
        )}

        <section style={{ marginBottom: 32 }}>
          <SectionTitle>Active categories</SectionTitle>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>domain</th>
                <th style={thStyleR}>entities</th>
                <th style={thStyleR}>variants</th>
                <th style={thStyleR}>answered</th>
                <th style={thStyleR}>unknown</th>
                <th style={thStyleR}>gaps</th>
                <th style={thStyleR}>demand</th>
                <th style={thStyleR}>coverage %</th>
                <th style={thStyleR}>answered %</th>
                <th style={thStyleR}>avg verify ms</th>
              </tr>
            </thead>
            <tbody>
              {nonEmptyCategories.map((c) => (
                <tr key={c.domain}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#f59e0b" }}>{c.domain}</td>
                  <td style={tdStyleR}>{c.entities.toLocaleString()}</td>
                  <td style={tdStyleR}>{c.question_variants.toLocaleString()}</td>
                  <td style={tdStyleR}>{c.answered.toLocaleString()}</td>
                  <td style={tdStyleR}>{c.unknown.toLocaleString()}</td>
                  <td style={tdStyleR}>{c.open_gaps.toLocaleString()}</td>
                  <td style={tdStyleR}>{c.gap_demand_sum.toLocaleString()}</td>
                  <td style={tdStyleR}>{c.coverage_pct.toFixed(3)}%</td>
                  <td style={tdStyleR}>{c.answered_pct.toFixed(2)}%</td>
                  <td style={tdStyleR}>{c.avg_verify_ms ?? "—"}</td>
                </tr>
              ))}
              {nonEmptyCategories.length === 0 && (
                <tr><td colSpan={10} style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}>
                  no active categories yet
                </td></tr>
              )}
            </tbody>
          </table>
          {emptyCategories.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
              scaffolded (no data yet): {emptyCategories.map((c) => c.domain).join(", ")}
            </div>
          )}
        </section>

        <section style={{ marginBottom: 32 }}>
          <SectionTitle>Workers</SectionTitle>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>worker</th>
                <th style={thStyle}>domain</th>
                <th style={thStyle}>reported</th>
                <th style={thStyle}>supervised</th>
                <th style={thStyleR}>heartbeat ms</th>
                <th style={thStyle}>current task</th>
                <th style={thStyleR}>tasks ok</th>
                <th style={thStyleR}>failed</th>
              </tr>
            </thead>
            <tbody>
              {(state.data?.workers ?? []).map((w) => (
                <tr key={w.worker_id}>
                  <td style={tdStyle}>{w.worker_id}</td>
                  <td style={tdStyle}>{w.domain}</td>
                  <td style={{ ...tdStyle, color: stateColor(w.reported_state) }}>{w.reported_state}</td>
                  <td style={{ ...tdStyle, color: stateColor(w.supervised_state) }}>{w.supervised_state}</td>
                  <td style={{ ...tdStyleR, color: w.heartbeat_stale_ms > 90_000 ? "#ef4444" : "#e5e7eb" }}>
                    {w.heartbeat_stale_ms.toLocaleString()}
                  </td>
                  <td style={tdStyle}>{w.current_task ?? "—"}</td>
                  <td style={tdStyleR}>{w.tasks_completed.toLocaleString()}</td>
                  <td style={{ ...tdStyleR, color: w.tasks_failed > 0 ? "#f59e0b" : "#e5e7eb" }}>
                    {w.tasks_failed.toLocaleString()}
                  </td>
                </tr>
              ))}
              {(!state.data || state.data.workers.length === 0) && (
                <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}>
                  no workers registered
                </td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
          <div>
            <SectionTitle>Top open gap intents (customer demand)</SectionTitle>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>domain</th>
                  <th style={thStyle}>intent</th>
                  <th style={thStyleR}>gaps</th>
                  <th style={thStyleR}>demand</th>
                </tr>
              </thead>
              <tbody>
                {(state.data?.top_gap_intents ?? []).slice(0, 12).map((g) => (
                  <tr key={`${g.domain}:${g.intent_slug}`}>
                    <td style={tdStyle}>{g.domain}</td>
                    <td style={tdStyle}>{g.intent_slug}</td>
                    <td style={tdStyleR}>{g.gaps.toLocaleString()}</td>
                    <td style={{ ...tdStyleR, fontWeight: 600, color: "#f59e0b" }}>{g.demand.toLocaleString()}</td>
                  </tr>
                ))}
                {(!state.data || state.data.top_gap_intents.length === 0) && (
                  <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}>
                    no open gaps
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div>
            <SectionTitle>Retrieval hits (last hour · sampled)</SectionTitle>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>level</th>
                  <th style={thStyleR}>total</th>
                  <th style={thStyleR}>matched</th>
                  <th style={thStyleR}>match %</th>
                  <th style={thStyleR}>avg ms</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(state.data?.retrieval_by_level_last_hour ?? {}).map(([lvl, s]) => (
                  <tr key={lvl}>
                    <td style={tdStyle}>{lvl}</td>
                    <td style={tdStyleR}>{s.total.toLocaleString()}</td>
                    <td style={tdStyleR}>{s.matched.toLocaleString()}</td>
                    <td style={tdStyleR}>{s.total ? ((s.matched / s.total) * 100).toFixed(1) : "—"}%</td>
                    <td style={tdStyleR}>{s.avg_ms.toLocaleString()}</td>
                  </tr>
                ))}
                {(!state.data || Object.keys(state.data.retrieval_by_level_last_hour).length === 0) && (
                  <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}>
                    no retrieval samples in last hour
                  </td></tr>
                )}
              </tbody>
            </table>

            <SectionTitle>Fact conflicts by domain</SectionTitle>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>domain</th>
                  <th style={thStyleR}>open</th>
                  <th style={thStyleR}>total seen</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(state.data?.fact_conflicts_by_domain ?? {}).map(([d, s]) => (
                  <tr key={d}>
                    <td style={tdStyle}>{d}</td>
                    <td style={{ ...tdStyleR, color: s.open > 0 ? "#f59e0b" : "#e5e7eb" }}>{s.open}</td>
                    <td style={tdStyleR}>{s.total_seen}</td>
                  </tr>
                ))}
                {(!state.data || Object.keys(state.data.fact_conflicts_by_domain).length === 0) && (
                  <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}>
                    no conflicts detected
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 15, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase",
    letterSpacing: "0.08em", margin: "0 0 8px 0" }}>{children}</h2>;
}

const tableStyle: React.CSSProperties = {
  width: "100%", borderCollapse: "collapse", background: "#111827",
  borderRadius: 8, overflow: "hidden", fontSize: 13,
};
const thStyle: React.CSSProperties = { padding: "8px 12px", textAlign: "left", background: "#1f2937",
  color: "#9ca3af", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" };
const thStyleR: React.CSSProperties = { ...thStyle, textAlign: "right" };
const tdStyle: React.CSSProperties = { padding: "8px 12px", borderTop: "1px solid #1f2937", verticalAlign: "top" };
const tdStyleR: React.CSSProperties = { ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" };

function stateColor(s: string): string {
  switch (s) {
    case "RUNNING": return "#22c55e";
    case "IDLE": return "#9ca3af";
    case "PAUSED": return "#f59e0b";
    case "DEGRADED": return "#f97316";
    case "FAILED":
    case "STALE": return "#ef4444";
    case "RECOVERING": return "#38bdf8";
    default: return "#e5e7eb";
  }
}
