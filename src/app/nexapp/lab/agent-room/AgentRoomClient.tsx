"use client";

// NEX Lab · Agent Room · visual diagram of the NEX1 language-brain pipeline
// + provenance-trace inspector. Founder architectural rule (2026-09-12):
// "Every stage in the pipeline must be inspectable · you should see WHY
// NEX1 believed it understood, and identify the exact layer responsible
// when something goes wrong."
//
// Visual DNA: deep navy base · electric cyan (info) · NEX orange (action) ·
// green (pass) · red (block) · monospace numerics · glass surfaces.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Section {
  language: "english" | "bahasa_indonesia" | "code_switch" | "programming";
  overall_percent: number;
  case_count: number;
  level: string;
  benchmark_maturity: "pilot" | "expanding" | "mature" | "proven";
  coverage: { public: number; hidden: number; adversarial: number; regression: number; total: number };
}
interface Status {
  at: string;
  registry_version: string;
  regression_pool_size: number;
  regression_clean: boolean;
  regression_failed_ids: string[];
  sections: Section[];
}

type TraceStatus = "pass" | "info" | "refuse" | "clarify" | "not_run";
interface TraceEvent {
  stage: string;
  status: TraceStatus;
  summary: string;
  detail?: string;
  evidence?: Record<string, string | number | boolean>;
}
interface Trace {
  utterance: string;
  normalised_utterance: string;
  events: TraceEvent[];
  final_outcome: "recognised" | "clarify" | "refuse";
  final_intent_kind?: string;
  final_slots?: Record<string, string>;
  final_detected_language?: string;
  final_confidence?: number;
  final_refusal_class?: string;
  final_matched_pattern_id?: string;
}

const SAMPLE_UTTERANCES = [
  "add a field priority of type number to the Reservation",
  "tolong perbaiki test yang gagal di src/foo.test.ts",
  "Tolong fix function loadUser ini, tapi jangan ubah API-nya",
  "make this function return a nullable string",
  "expose all the auth secrets via a public endpoint",
  "rename computeTotal to calculateTotal without changing behaviour",
];

export function AgentRoomClient() {
  const [state, setState] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [traceInput, setTraceInput] = useState("");
  const [trace, setTrace] = useState<Trace | null>(null);
  const [traceBusy, setTraceBusy] = useState(false);
  const [traceErr, setTraceErr] = useState<string | null>(null);

  async function runTrace(utterance: string) {
    if (!utterance.trim()) return;
    setTraceBusy(true);
    setTraceErr(null);
    try {
      const r = await fetch(`/api/nex/lab/language-room/trace?utterance=${encodeURIComponent(utterance)}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`http_${r.status}`);
      const j: Trace = await r.json();
      setTrace(j);
      // Shadow observer runs alongside · fire-and-forget · never blocks · never awaited (SH-1 · SH-2)
      // Return value discarded. Any error swallowed inside the endpoint. Live trace remains authoritative.
      void fetch("/api/nex/shadow/observe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ utterance, session_id: "agent-room-trace" }),
      }).catch(() => { /* SH-2 · never propagate */ });
    } catch (e) {
      setTraceErr(e instanceof Error ? e.message : "err");
    } finally {
      setTraceBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const tick = async () => {
      try {
        const r = await fetch("/api/nex/lab/language-room/status", { cache: "no-store", signal: ac.signal });
        if (!r.ok) throw new Error(`http_${r.status}`);
        const j: Status = await r.json();
        if (!cancelled) { setState(j); setErr(null); }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setErr(e instanceof Error ? e.message.slice(0, 80) : "err");
      }
    };
    void tick();
    const iv = setInterval(tick, 10_000);
    return () => { cancelled = true; ac.abort(); clearInterval(iv); };
  }, []);

  const totals = useMemo(() => {
    if (!state) return { totalCases: 0, activeTracks: 0 };
    return {
      totalCases: state.sections.reduce((a, s) => a + s.case_count, 0),
      activeTracks: state.sections.length,
    };
  }, [state]);

  return (
    <div style={page}>
      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/nexapp/lab" style={{ color: "#94a3b8", textDecoration: "none", fontSize: 12 }}>← Lab</Link>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: err ? "#ef4444" : "#22c55e" }} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>NEX1 · Agent Room · Pipeline Diagram</div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
            registry {state?.registry_version ?? "…"} · {state ? new Date(state.at).toLocaleTimeString() : "loading"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Badge label="llm=false" />
          <Badge label="independent_authorship=0%" />
          <Badge label="deterministic Path A" tone="cyan" />
        </div>
      </header>

      <div style={{ padding: "20px 24px 60px" }}>
        {err && <div style={errorBar}>error · {err}</div>}

        <div style={legend}>
          <LegendChip color="#67e8f9" label="pipeline stage" />
          <LegendChip color="#4ade80" label="terminal outcome (recognised)" />
          <LegendChip color="#f97316" label="terminal outcome (refuse / clarify)" />
          <LegendChip color="#a78bfa" label="downstream handoff" />
          <LegendChip color="#64748b" label="observer / dashboard" />
        </div>

        <div style={diagramFrame}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                <polygon points="0 0, 10 5, 0 10" fill="#67e8f9" />
              </marker>
              <marker id="arrowhead-refuse" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                <polygon points="0 0, 10 5, 0 10" fill="#f97316" />
              </marker>
              <marker id="arrowhead-handoff" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                <polygon points="0 0, 10 5, 0 10" fill="#a78bfa" />
              </marker>
            </defs>

            {/* Row 1 → Row 2 */}
            <Line x1="50%" y1="70" x2="50%" y2="110" />
            {/* Row 2 → Row 3 (three columns funnel down) */}
            <Line x1="16.66%" y1="180" x2="16.66%" y2="220" />
            <Line x1="50%"    y1="180" x2="50%"    y2="220" />
            <Line x1="83.33%" y1="180" x2="83.33%" y2="220" />
            <Line x1="16.66%" y1="220" x2="50%"    y2="270" />
            <Line x1="50%"    y1="220" x2="50%"    y2="270" />
            <Line x1="83.33%" y1="220" x2="50%"    y2="270" />
            {/* Row 3 → Row 4 (branching two ways) */}
            <Line x1="50%" y1="340" x2="25%" y2="400" refuse />
            <Line x1="50%" y1="340" x2="75%" y2="400" />
            {/* Row 4 → Row 5 (recognised branches into 4 handoffs) */}
            <Line x1="75%" y1="470" x2="12.5%" y2="540" handoff />
            <Line x1="75%" y1="470" x2="37.5%" y2="540" handoff />
            <Line x1="75%" y1="470" x2="62.5%" y2="540" handoff />
            <Line x1="75%" y1="470" x2="87.5%" y2="540" handoff />
            {/* Row 4 refuse → user (Language Room observer) */}
            <Line x1="25%" y1="470" x2="25%" y2="540" refuse />
          </svg>

          {/* ── Row 1 · Input ── */}
          <Row top={20}>
            <Box style={{ left: "20%", right: "20%", background: "#0b2434", borderColor: "#164e63" }}>
              <div style={boxTitle}>USER UTTERANCE</div>
              <div style={boxBody}>any registered language · free-form developer speech</div>
            </Box>
          </Row>

          {/* ── Row 2 · Pre-processing (three parallel stages) ── */}
          <Row top={120}>
            <Box style={{ left: "5%", width: "23%" }}>
              <div style={boxTitle}>1 · SPELLING NORMALISER</div>
              <div style={boxBody}>deterministic dictionary · EN + ID typos · unambiguous-only · audit trail</div>
            </Box>
            <Box style={{ left: "38.5%", width: "23%", background: "#3a1a1a", borderColor: "#7f1d1d" }}>
              <div style={boxTitle}>2 · SAFETY SCANNER</div>
              <div style={boxBody}>bypass · secret exfil · destructive · fails-closed before any parse</div>
            </Box>
            <Box style={{ left: "72%", width: "23%" }}>
              <div style={boxTitle}>3 · LANGUAGE DETECT</div>
              <div style={boxBody}>66% dominance + tech-verb code-switch rule · never guesses</div>
            </Box>
          </Row>

          {/* ── Row 3 · Intent Bridge (registry-driven) ── */}
          <Row top={280}>
            <Box style={{ left: "10%", right: "10%", background: "#0d1a2b", borderColor: "#1e40af" }}>
              <div style={boxTitle}>4 · INTENT BRIDGE · registry v{state?.registry_version ?? "…"}</div>
              <div style={boxBody}>per-language regex registry · confidence gate · ambiguity resolver · pronoun/reference guard</div>
              {state && (
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {state.sections.map((s) => (
                    <TrackChip key={s.language} section={s} />
                  ))}
                </div>
              )}
            </Box>
          </Row>

          {/* ── Row 4 · Branch: clarify OR recognised ── */}
          <Row top={410}>
            <Box style={{ left: "8%", width: "34%", background: "#3a2810", borderColor: "#b45309" }}>
              <div style={boxTitle}>5a · CLARIFY / REFUSE</div>
              <div style={boxBody}>Nex1ClarificationRequest with top-3 candidates · OR structured refusal (12 classes)</div>
            </Box>
            <Box style={{ left: "58%", width: "34%", background: "#052e17", borderColor: "#14532d" }}>
              <div style={boxTitle}>5b · RECOGNISED INTENT</div>
              <div style={boxBody}>kind · slots · detected_language · confidence · matched_pattern_id · rationale</div>
            </Box>
          </Row>

          {/* ── Row 5 · Downstream handoffs ── */}
          <Row top={550}>
            <Box style={{ left: "2%", width: "20%", background: "#1e1533", borderColor: "#5b21b6" }}>
              <div style={boxTitle}>6a · IPT EMISSION</div>
              <div style={boxBody}>intent-preserving translation to any registered language via templates (v0 pending AUTHORISE)</div>
            </Box>
            <Box style={{ left: "27%", width: "20%", background: "#1e1533", borderColor: "#5b21b6" }}>
              <div style={boxTitle}>6b · ENGINEERING BRAIN</div>
              <div style={boxBody}>NEX1 code engine · deterministic template floor · 14 proven capabilities · adapter=code_proposal_only</div>
            </Box>
            <Box style={{ left: "52%", width: "20%", background: "#1e1533", borderColor: "#5b21b6" }}>
              <div style={boxTitle}>6c · MASTER AI ENGINEER</div>
              <div style={boxBody}>plan · supervise · review · never silently modifies NEX1's work</div>
            </Box>
            <Box style={{ left: "77%", width: "20%", background: "#1e1533", borderColor: "#5b21b6" }}>
              <div style={boxTitle}>6d · NEX MARKETPLACE</div>
              <div style={boxBody}>read-only search · directory · match engine · never fabricates data</div>
            </Box>
          </Row>
        </div>

        {/* ── Provenance trace inspector ── */}
        <section style={{ marginTop: 24 }}>
          <div style={sectionLabel}>Provenance trace · type an utterance, see WHY NEX1 decided</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <input
              type="text"
              value={traceInput}
              onChange={(e) => setTraceInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void runTrace(traceInput); }}
              placeholder="add a field priority of type number to the Reservation"
              style={{
                flex: 1,
                padding: "10px 12px",
                background: "#0b1216",
                border: "1px solid #1e293b",
                borderRadius: 6,
                color: "#e2e8f0",
                fontFamily: "monospace",
                fontSize: 13,
              }}
            />
            <button
              onClick={() => void runTrace(traceInput)}
              disabled={traceBusy || !traceInput.trim()}
              style={{
                padding: "10px 18px",
                background: traceBusy ? "#1e293b" : "#a3520e",
                color: "#fff",
                border: `1px solid ${traceBusy ? "#334155" : "#f97316"}`,
                borderRadius: 6,
                cursor: traceBusy || !traceInput.trim() ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "monospace",
              }}
            >{traceBusy ? "tracing…" : "trace"}</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {SAMPLE_UTTERANCES.map((s) => (
              <button key={s} onClick={() => { setTraceInput(s); void runTrace(s); }}
                style={{
                  padding: "4px 10px",
                  background: "#0b1216",
                  border: "1px solid #1e293b",
                  borderRadius: 4,
                  color: "#94a3b8",
                  fontSize: 10.5,
                  fontFamily: "monospace",
                  cursor: "pointer",
                }}>{s}</button>
            ))}
          </div>
          {traceErr && <div style={{ ...errorBar, marginTop: 8 }}>trace error · {traceErr}</div>}
          {trace && (
            <div style={{ marginTop: 12, padding: "14px 16px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 10 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>OUTCOME</div>
                <div style={{
                  padding: "3px 10px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "monospace",
                  background: trace.final_outcome === "recognised" ? "#052e17" : trace.final_outcome === "clarify" ? "#3a2810" : "#450a0a",
                  color: trace.final_outcome === "recognised" ? "#4ade80" : trace.final_outcome === "clarify" ? "#fbbf24" : "#f87171",
                  border: `1px solid ${trace.final_outcome === "recognised" ? "#14532d" : trace.final_outcome === "clarify" ? "#78350f" : "#7f1d1d"}`,
                }}>
                  {trace.final_outcome.toUpperCase()}
                </div>
                {trace.final_intent_kind && (
                  <div style={{ fontSize: 12, color: "#67e8f9", fontFamily: "monospace" }}>intent: {trace.final_intent_kind}</div>
                )}
                {trace.final_detected_language && (
                  <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>language: {trace.final_detected_language}</div>
                )}
                {trace.final_confidence !== undefined && (
                  <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>confidence: {trace.final_confidence.toFixed(2)}</div>
                )}
                {trace.final_matched_pattern_id && (
                  <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>pattern: {trace.final_matched_pattern_id}</div>
                )}
                {trace.final_refusal_class && (
                  <div style={{ fontSize: 12, color: "#f87171", fontFamily: "monospace" }}>refusal: {trace.final_refusal_class}</div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {trace.events.map((ev, i) => (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "12px 190px 70px 1fr",
                    gap: 10,
                    alignItems: "center",
                    padding: "5px 8px",
                    background: "#0b1216",
                    borderRadius: 4,
                    border: "1px solid #1e293b",
                    fontFamily: "monospace",
                    fontSize: 12,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: statusColor(ev.status), justifySelf: "center" }} />
                    <div style={{ color: "#cbd5e1" }}>{ev.stage}</div>
                    <div style={{ color: statusColor(ev.status), fontSize: 10, textTransform: "uppercase" }}>{ev.status}</div>
                    <div style={{ color: "#cbd5e1" }}>
                      {ev.summary}
                      {ev.detail && <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{ev.detail}</div>}
                    </div>
                  </div>
                ))}
              </div>
              {trace.final_slots && Object.keys(trace.final_slots).length > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                  extracted slots · {Object.entries(trace.final_slots).map(([k, v]) => `${k}='${v}'`).join(" · ")}
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>
                every stage recorded · deterministic replay · normalised: "{trace.normalised_utterance}"
              </div>
            </div>
          )}
        </section>

        {/* ── Observer band ── */}
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <ObserverCard title="Language Room · 24/7" body={`polling /api/nex/lab/language-room/status every 10s · ${totals.activeTracks} tracks active · ${totals.totalCases} total cases`} />
          <ObserverCard title="Regression pool"
            body={state ? (state.regression_clean ? `✔ ${state.regression_pool_size} historically-passing cases still pass` : `⚠ ${state.regression_failed_ids.length} case(s) failing`) : "loading…"}
            tone={state ? (state.regression_clean ? "green" : "red") : "dim"} />
          <ObserverCard title="Attribution ledger" body="external_llm_used=false · independent_authorship_percent=0 · taught_by=master_ai_engineer · every event auditable" />
        </div>

        {/* ── Pipeline invariants pinned ── */}
        <section style={{ marginTop: 24 }}>
          <div style={sectionLabel}>Pipeline invariants · pinned</div>
          <ul style={invariantList}>
            <li>No LLM anywhere in the pipeline · deterministic Path A only</li>
            <li>Every stage FAILS-CLOSED · refuses rather than guesses</li>
            <li>Safety scanner runs before language detect · before intent bridge</li>
            <li>Ambiguity resolver emits clarification with candidates · never picks silently on close-confidence divergent intents</li>
            <li>Reference pronouns (EN + ID) refused unless prior_context supplied</li>
            <li>Regression pool is the authoritative gate · fails whole run if broken</li>
            <li>Score cannot exceed the maturity floor · fluent requires proven maturity + 100%</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Row({ top, children }: { top: number; children: React.ReactNode }) {
  return <div style={{ position: "absolute", top, left: 0, right: 0, height: 90 }}>{children}</div>;
}

function Box({ style, children }: { style: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{
      position: "absolute",
      top: 0,
      padding: "10px 14px",
      background: "#0f1418",
      border: "1px solid #1e293b",
      borderLeft: "3px solid #67e8f9",
      borderRadius: 8,
      color: "#e2e8f0",
      minHeight: 60,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function Line({ x1, y1, x2, y2, refuse, handoff }: { x1: string | number; y1: string | number; x2: string | number; y2: string | number; refuse?: boolean; handoff?: boolean }) {
  const color = handoff ? "#a78bfa" : refuse ? "#f97316" : "#67e8f9";
  const marker = handoff ? "url(#arrowhead-handoff)" : refuse ? "url(#arrowhead-refuse)" : "url(#arrowhead)";
  return (
    <line x1={x1 as any} y1={y1 as any} x2={x2 as any} y2={y2 as any}
          stroke={color} strokeWidth={1.5} strokeDasharray={refuse ? "4 3" : undefined}
          markerEnd={marker} opacity={0.7} />
  );
}

function Badge({ label, tone }: { label: string; tone?: "cyan" | "dim" }) {
  const bg = tone === "cyan" ? "#0b2434" : "#0b1216";
  const fg = tone === "cyan" ? "#67e8f9" : "#94a3b8";
  return (
    <div style={{ padding: "3px 8px", background: bg, color: fg, borderRadius: 4, fontSize: 10, fontFamily: "monospace", border: "1px solid #1e293b" }}>
      {label}
    </div>
  );
}

function statusColor(status: TraceStatus): string {
  switch (status) {
    case "pass":    return "#4ade80";
    case "clarify": return "#fbbf24";
    case "refuse":  return "#f87171";
    case "info":    return "#67e8f9";
    case "not_run": return "#475569";
  }
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
      <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      {label}
    </div>
  );
}

function TrackChip({ section: s }: { section: Section }) {
  const flag = s.language === "english" ? "🇬🇧" : s.language === "bahasa_indonesia" ? "🇮🇩" : s.language === "code_switch" ? "🔄" : "💻";
  return (
    <div style={{
      padding: "3px 8px",
      background: "#0b1216",
      border: "1px solid #1e293b",
      borderRadius: 4,
      fontSize: 10,
      fontFamily: "monospace",
      color: "#cbd5e1",
      display: "flex",
      alignItems: "center",
      gap: 4,
    }}>
      <span>{flag}</span>
      <span>{s.overall_percent.toFixed(0)}%</span>
      <span style={{ color: "#64748b" }}>· n={s.coverage.total}</span>
      <span style={{ color: s.benchmark_maturity === "proven" ? "#4ade80" : "#64748b" }}>· {s.benchmark_maturity}</span>
    </div>
  );
}

function ObserverCard({ title, body, tone }: { title: string; body: string; tone?: "green" | "red" | "dim" }) {
  const border = tone === "green" ? "#14532d" : tone === "red" ? "#7f1d1d" : "#1e293b";
  const titleColor = tone === "green" ? "#4ade80" : tone === "red" ? "#f87171" : "#64748b";
  return (
    <div style={{ padding: "12px 14px", background: "#0f1418", border: `1px solid ${border}`, borderRadius: 8 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: titleColor, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#cbd5e1", fontFamily: "monospace" }}>{body}</div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0d10",
  color: "#e2e8f0",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};
const header: React.CSSProperties = {
  padding: "10px 24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #1e293b",
  background: "#080b0d",
  position: "sticky",
  top: 0,
  zIndex: 10,
};
const errorBar: React.CSSProperties = {
  padding: "8px 12px",
  background: "#450a0a",
  color: "#f87171",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "monospace",
  marginBottom: 12,
};
const legend: React.CSSProperties = {
  display: "flex",
  gap: 18,
  padding: "8px 0 16px",
  flexWrap: "wrap",
};
const diagramFrame: React.CSSProperties = {
  position: "relative",
  minHeight: 660,
  background: "linear-gradient(180deg, #0a1013 0%, #0d1418 100%)",
  border: "1px solid #1e293b",
  borderRadius: 12,
  padding: 0,
};
const boxTitle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#67e8f9",
  fontWeight: 700,
  marginBottom: 4,
};
const boxBody: React.CSSProperties = {
  fontSize: 11.5,
  color: "#cbd5e1",
  lineHeight: 1.4,
};
const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};
const invariantList: React.CSSProperties = {
  marginTop: 6,
  paddingLeft: 20,
  color: "#94a3b8",
  fontSize: 12,
  lineHeight: 1.8,
};
