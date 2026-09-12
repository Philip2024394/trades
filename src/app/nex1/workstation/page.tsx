// NEX1 Minimal Workstation · Phase 7 · functional not beautiful.
// One page. Founder submits a request, watches the pipeline, decides.

"use client";
import { useState } from "react";
import type { WorkflowTrace, StageId, StageStatus } from "@/lib/nex1-orchestrator/types";

const ORDER: StageId[] = ["REQUEST_RECEIVED","UNDERSTANDING","REQUIREMENTS","WORK_ORDER","ARCHITECTURE","DESIGN","BUILD_PLAN","SPECIALIST_EVIDENCE","EVIDENCE_VALIDATION","NEX2_REVIEW","NEX3_ARBITRATION","FOUNDER_DECISION","EXECUTION","VERIFICATION","RELEASE","ORCHESTRATION_COMPLETED","DELIVERABLE_COMPLETED"];
const TERMINAL: StageId[] = ["ORCHESTRATION_COMPLETED","DELIVERABLE_COMPLETED","BLOCKED","REJECTED","HOLD"];

function statusGlyph(s: StageStatus | undefined): string {
  if (!s) return "○";
  if (s === "COMPLETE") return "✓";
  if (s === "RUNNING") return "●";
  if (s === "BLOCKED") return "✗ BLOCKED";
  if (s === "REJECTED") return "✗ REJECTED";
  if (s === "HOLD") return "⏸ HOLD";
  if (s === "NOT_IMPLEMENTED") return "○ NOT_IMPLEMENTED";
  if (s === "LIMITED_V0") return "⚠ LIMITED_V0";
  return "○ PENDING";
}

export default function WorkstationPage() {
  const [request, setRequest] = useState("Build a staircase parts supplier landing page with product categories, timber categories, enquiry/contact action, responsive mobile layout, and product imagery.");
  const [trace, setTrace] = useState<WorkflowTrace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/nex1/orchestrator/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw_request: request }) });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "submit failed"); setTrace(null); }
      else setTrace(j);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const decide = async (decision: "AUTHORISE" | "REJECT" | "HOLD") => {
    if (!trace) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/nex1/orchestrator/decision", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace_id: trace.trace_id, decision, founder_authorisation_token: decision === "AUTHORISE" ? "FA-WORKSTATION-" + Date.now().toString(36) : "", reason: decision === "AUTHORISE" ? "founder authorised via workstation" : "founder " + decision.toLowerCase() + " via workstation" }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "decision failed");
      else setTrace(j);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  return (
    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", padding: 16, maxWidth: 1100, margin: "0 auto", lineHeight: 1.4, color: "#111" }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>NEX1 MINIMAL WORKSTATION · Phase 7 · v0.1.0</h1>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 12 }}>Functional engineering control panel · not beautiful · not production-ready · LIMITED_V0 markers preserved</div>

      <section style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>A · REQUEST</div>
        <textarea value={request} onChange={(e) => setRequest(e.target.value)} rows={3} style={{ width: "100%", fontFamily: "inherit", fontSize: 12 }} disabled={busy} />
        <button onClick={submit} disabled={busy} style={{ marginTop: 6, padding: "4px 10px" }}>{busy ? "…" : "SUBMIT"}</button>
        {error && <div style={{ color: "crimson", marginTop: 6 }}>ERROR: {error}</div>}
      </section>

      {trace && (
        <>
          <section style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>B · UNDERSTANDING</div>
            <div style={{ fontSize: 12 }}>trace_id: <code>{trace.trace_id}</code></div>
            <div style={{ fontSize: 12 }}>raw_request: <em>{trace.raw_request}</em></div>
            {trace.structured_intent && (
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <div>page_type: <code>{trace.structured_intent.page_type ?? "(unspecified)"}</code></div>
                <div>primary_goal: <code>{trace.structured_intent.primary_goal ?? "(unspecified)"}</code></div>
                <div>must_have_features: <code>[{trace.structured_intent.must_have_features.join(", ")}]</code></div>
                <div>extractor: <code>{trace.structured_intent.deterministic_extractor_version}</code></div>
              </div>
            )}
          </section>

          <section style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>C · WORK ORDER</div>
            {trace.work_order ? (
              <pre style={{ fontSize: 11, margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(trace.work_order, null, 2)}</pre>
            ) : <div style={{ fontSize: 12, color: "#888" }}>work order not yet composed</div>}
          </section>

          <section style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>D · PIPELINE</div>
            <div style={{ fontSize: 12 }}>current_state: <code>{trace.current_state}</code></div>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginTop: 6 }}>
              <thead><tr><th style={{ textAlign: "left", padding: "2px 4px" }}>stage</th><th style={{ textAlign: "left", padding: "2px 4px" }}>status</th><th style={{ textAlign: "left", padding: "2px 4px" }}>evidence_ref</th><th style={{ textAlign: "left", padding: "2px 4px" }}>note</th></tr></thead>
              <tbody>
                {ORDER.map((s) => {
                  const r = trace.stage_statuses[s];
                  return (<tr key={s} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "2px 4px" }}><code>{s}</code></td>
                    <td style={{ padding: "2px 4px" }}>{statusGlyph(r?.status)}</td>
                    <td style={{ padding: "2px 4px" }}><code>{r?.evidence_ref ?? ""}</code></td>
                    <td style={{ padding: "2px 4px", color: "#888" }}>{r?.limitation_note ?? ""}</td>
                  </tr>);
                })}
                {TERMINAL.filter((s) => trace.stage_statuses[s]).map((s) => {
                  const r = trace.stage_statuses[s];
                  return (<tr key={s} style={{ borderTop: "1px solid #eee", background: "#fff4f4" }}>
                    <td style={{ padding: "2px 4px" }}><code>{s}</code></td>
                    <td style={{ padding: "2px 4px" }}>{statusGlyph(r?.status)}</td>
                    <td style={{ padding: "2px 4px" }}></td>
                    <td style={{ padding: "2px 4px", color: "#888" }}>{r?.limitation_note ?? ""}</td>
                  </tr>);
                })}
              </tbody>
            </table>
          </section>

          <section style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>E · EVIDENCE</div>
            <div style={{ fontSize: 12 }}>specialist evidence ids: <code>{trace.specialist_evidence_ids.length}</code></div>
            <div style={{ fontSize: 12 }}>validation verdicts: <code>{trace.validation_verdicts.length}</code></div>
            <div style={{ fontSize: 11, marginTop: 4 }}>{trace.specialist_evidence_ids.map((id) => <div key={id}><code>{id}</code></div>)}</div>
          </section>

          <section style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>F · NEX2 · advisory review</div>
            <div style={{ fontSize: 12 }}>review_id: <code>{trace.nex2_review_id ?? "(pending)"}</code></div>
          </section>

          <section style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>G · NEX3 · evidence-based arbitration</div>
            <div style={{ fontSize: 12 }}>arbitration_id: <code>{trace.nex3_arbitration_id ?? "(pending)"}</code></div>
            <div style={{ fontSize: 12 }}>verdict: <code>{trace.nex3_verdict ?? "(pending)"}</code></div>
          </section>

          <section style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10, background: trace.current_state === "FOUNDER_DECISION" ? "#fff8dc" : "#fafafa" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>H · FOUNDER CONTROL</div>
            <div style={{ fontSize: 12, marginBottom: 6 }}>decision: <code>{trace.founder_decision ?? "(awaiting)"}</code></div>
            {trace.current_state === "FOUNDER_DECISION" ? (
              <div>
                <button onClick={() => decide("AUTHORISE")} disabled={busy} style={{ padding: "4px 10px", marginRight: 6 }}>AUTHORISE</button>
                <button onClick={() => decide("REJECT")} disabled={busy} style={{ padding: "4px 10px", marginRight: 6 }}>REJECT</button>
                <button onClick={() => decide("HOLD")} disabled={busy} style={{ padding: "4px 10px" }}>HOLD</button>
                <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>silence is NOT approval · absence of AUTHORISE is not authorisation</div>
              </div>
            ) : <div style={{ fontSize: 11, color: "#666" }}>founder controls only available in FOUNDER_DECISION state · current: <code>{trace.current_state}</code></div>}
          </section>

          <section style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>I · AUDIT TRACE</div>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead><tr><th style={{ textAlign: "left" }}>at</th><th style={{ textAlign: "left" }}>actor</th><th style={{ textAlign: "left" }}>action</th><th style={{ textAlign: "left" }}>detail</th></tr></thead>
              <tbody>
                {trace.audit_trail.map((e, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                    <td><code>{e.at}</code></td>
                    <td><code>{e.actor}</code></td>
                    <td><code>{e.action}</code></td>
                    <td>{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10, background: "#fff4e0" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>DELIBERATE v0.1.0 LIMITATIONS</div>
            <ul style={{ fontSize: 12, margin: 0, paddingLeft: 16 }}>
              <li>EXECUTION / VERIFICATION / RELEASE stages are NOT_IMPLEMENTED · Builder remains plan-and-propose</li>
              <li>Test / Security / Performance / Dependency / Documentation / Release specialists are LIMITED_V0 · deterministic fixtures, not real vendor-tool bindings</li>
              <li>Live preview is NOT_IMPLEMENTED</li>
              <li>Image generation is NOT_IMPLEMENTED · Independence Constitution forbids external image-gen service</li>
              <li>Application source files are NOT created on disk</li>
              <li>Standards Feed is in-memory only</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
