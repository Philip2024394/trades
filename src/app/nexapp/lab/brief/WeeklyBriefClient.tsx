"use client";

// Founder Weekly Brief · every number measured · never fabricated.

import Link from "next/link";
import { useEffect, useState } from "react";

interface RoomMetrics {
  slug: string; display_name: string;
  harvest_rows_start: number; harvest_rows_end: number; harvest_delta: number;
  verified_rows_start: number; verified_rows_end: number; verified_delta: number;
  cross_verified_end: number; cross_verified_ratio: number;
}
interface Brief {
  brief_id: string; week_iso: string; generated_at_iso: string;
  totals: { harvest_delta: number; verified_delta: number; cross_verified_end: number;
            promotions_pending: number; promotions_succeeded_this_week: number; rows_promoted_this_week: number };
  rooms: RoomMetrics[];
  must_answer_questions: Array<{ id: string; question: string; measured_context: string }>;
  recommended_actions: string[];
  measured_at: string[];
}

export function WeeklyBriefClient() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/nex/lab/brief/weekly", { cache: "no-store" });
        if (!r.ok) throw new Error(`http_${r.status}`);
        const j = await r.json();
        if (!cancelled) { setBrief(j); setErr(null); }
      } catch (e) { if (!cancelled) setErr(e instanceof Error ? e.message : "err"); }
    };
    void load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  return (
    <div style={page}>
      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/nexapp/lab" style={{ color: "#94a3b8", textDecoration: "none", fontSize: 12 }}>← Lab</Link>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "#22c55e" }} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>Founder Weekly Brief · {brief?.week_iso ?? "—"}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
            {brief ? new Date(brief.generated_at_iso).toLocaleString() : "loading…"}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
          every number MEASURED · zero fabrication
        </div>
      </header>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
        {err && <div style={errorBar}>error · {err}</div>}

        {brief && (
          <>
            {/* Totals */}
            <section>
              <div style={sectionLabel}>Totals · past 7 days</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginTop: 8 }}>
                <Kpi label="harvest Δ"      value={fmtDelta(brief.totals.harvest_delta)} tone={brief.totals.harvest_delta > 0 ? "green" : "grey"} />
                <Kpi label="verified Δ"     value={fmtDelta(brief.totals.verified_delta)} tone={brief.totals.verified_delta > 0 ? "green" : "grey"} />
                <Kpi label="cross-verified" value={brief.totals.cross_verified_end.toLocaleString()} tone="cyan" />
                <Kpi label="pending"        value={brief.totals.promotions_pending.toString()} tone={brief.totals.promotions_pending > 0 ? "amber" : "grey"} />
                <Kpi label="promoted"       value={brief.totals.promotions_succeeded_this_week.toString()} tone="green" />
                <Kpi label="rows promoted"  value={brief.totals.rows_promoted_this_week.toLocaleString()} tone="green" />
              </div>
            </section>

            {/* Must-answer questions · founder decides */}
            <section>
              <div style={sectionLabel}>3 · Must-Answer Questions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {brief.must_answer_questions.map((q, i) => (
                  <div key={q.id} style={{ padding: "12px 14px", background: "#0f1418", border: "1px solid #22c55e33", borderRadius: 8 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 24, height: 24, borderRadius: 12, background: "#052e16", color: "#4ade80", fontWeight: 700, fontSize: 12, display: "grid", placeItems: "center" }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.5 }}>{q.question}</div>
                        <div style={{ marginTop: 4, fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>measured · {q.measured_context}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Per-room table */}
            <section>
              <div style={sectionLabel}>Per-room deltas</div>
              <div style={{ marginTop: 8, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: "#64748b", textAlign: "left" }}>
                      <th style={th}>Room</th>
                      <th style={th}>Harvest start → end</th>
                      <th style={th}>Δ harvest</th>
                      <th style={th}>Verified start → end</th>
                      <th style={th}>Δ verified</th>
                      <th style={th}>Cross-verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brief.rooms.map((r) => (
                      <tr key={r.slug} style={{ borderTop: "1px solid #1e293b" }}>
                        <td style={td}>{r.display_name}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.harvest_rows_start.toLocaleString()} → {r.harvest_rows_end.toLocaleString()}</td>
                        <td style={{ ...td, color: r.harvest_delta > 0 ? "#4ade80" : "#64748b", fontFamily: "monospace" }}>{fmtDelta(r.harvest_delta)}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.verified_rows_start.toLocaleString()} → {r.verified_rows_end.toLocaleString()}</td>
                        <td style={{ ...td, color: r.verified_delta > 0 ? "#4ade80" : "#64748b", fontFamily: "monospace" }}>{fmtDelta(r.verified_delta)}</td>
                        <td style={{ ...td, color: "#67e8f9", fontFamily: "monospace" }}>{r.cross_verified_end.toLocaleString()} ({(r.cross_verified_ratio * 100).toFixed(1)}%)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Actions */}
            <section>
              <div style={sectionLabel}>Recommended actions</div>
              <ul style={{ marginTop: 8, paddingLeft: 20, color: "#94a3b8", fontSize: 12, lineHeight: 1.8 }}>
                {brief.recommended_actions.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </section>

            {/* Provenance */}
            <section style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>
              measured_at: {brief.measured_at.join(" · ")}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "green" | "cyan" | "amber" | "grey" }) {
  const c = tone === "green" ? "#4ade80" : tone === "cyan" ? "#67e8f9" : tone === "amber" ? "#fbbf24" : "#94a3b8";
  return (
    <div style={{ padding: "10px 12px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: c, marginTop: 2, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

function fmtDelta(n: number): string { return (n >= 0 ? "+" : "") + n.toLocaleString(); }

const page: React.CSSProperties = { minHeight: "100vh", background: "#0a0d10", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
const header: React.CSSProperties = { padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", background: "#080b0d", position: "sticky", top: 0, zIndex: 10 };
const errorBar: React.CSSProperties = { padding: "8px 12px", background: "#450a0a", color: "#f87171", borderRadius: 6, fontSize: 12 };
const sectionLabel: React.CSSProperties = { fontSize: 11, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" };
const th: React.CSSProperties = { padding: "8px 12px", fontWeight: 600, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "8px 12px", color: "#e2e8f0" };
