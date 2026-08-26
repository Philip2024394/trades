// SixCriteriaTable · Client component · Task #72 Step 3
//
// Renders the six-criteria per-worker evidence table. Verdicts, counts
// and SQL text are pre-fetched by the server component and passed in ·
// this component only manages expand/collapse state for click-through.
//
// Never derives status from anything except the passed-in evaluation.
// Never re-fetches. Never infers. Never adds LLM commentary.

"use client";

import { Fragment, useState } from "react";
import type { CriteriaKey, CriterionResult, SixCriteriaVerdict, WorkerEvaluation } from "@/lib/nex/hq/worker-criteria";

const VERDICT_STYLE: Record<SixCriteriaVerdict, { glyph: string; bg: string; text: string; border: string; label: string }> = {
  GREEN:       { glyph: "🟢", bg: "rgba(16, 185, 129, 0.10)", text: "#047857", border: "rgba(16, 185, 129, 0.45)", label: "GREEN" },
  PARTIAL:     { glyph: "🟡", bg: "rgba(250, 204, 21, 0.12)", text: "#a16207", border: "rgba(250, 204, 21, 0.45)", label: "PARTIAL" },
  FAILED:      { glyph: "🔴", bg: "rgba(239, 68, 68, 0.10)",  text: "#b91c1c", border: "rgba(239, 68, 68, 0.45)", label: "FAILED" },
  STUCK:       { glyph: "🔵", bg: "rgba(59, 130, 246, 0.10)", text: "#1e40af", border: "rgba(59, 130, 246, 0.45)", label: "STUCK" },
  STANDBY:     { glyph: "💤", bg: "var(--nex-neutral-100)",   text: "var(--nex-neutral-600)", border: "var(--nex-neutral-300)", label: "STANDBY" },
  NOT_RUNNING: { glyph: "⚪", bg: "var(--nex-neutral-100)",   text: "var(--nex-neutral-600)", border: "var(--nex-neutral-300)", label: "NOT RUNNING" },
  BLOCKED:     { glyph: "⛔", bg: "rgba(107, 114, 128, 0.08)", text: "var(--nex-neutral-700)", border: "var(--nex-neutral-400)", label: "BLOCKED" },
  UNKNOWN:     { glyph: "❓", bg: "var(--nex-neutral-100)", text: "var(--nex-neutral-500)", border: "var(--nex-neutral-200)", label: "UNKNOWN" },
};

const CRITERIA_ORDER: CriteriaKey[] = ["input", "consumed", "output", "state", "heartbeat", "provable"];
const CRITERIA_LABEL: Record<CriteriaKey, string> = {
  input:     "1 · Input",
  consumed:  "2 · Consumed",
  output:    "3 · Output",
  state:     "4 · State advanced",
  heartbeat: "5 · Heartbeat current",
  provable:  "6 · DB-provable",
};

export interface SixCriteriaTableProps {
  workers: WorkerEvaluation[];
}

export default function SixCriteriaTable({ workers }: SixCriteriaTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (workers.length === 0) {
    return (
      <div style={{
        background: "var(--nex-neutral-0)", border: "1px dashed var(--nex-neutral-200)",
        borderRadius: 12, padding: "16px 18px", fontSize: 13,
        color: "var(--nex-neutral-700)", lineHeight: 1.55,
      }}>
        No workers registered. A worker appears here after either (a) writing a heartbeat to nex.worker_heartbeat
        via BrainStore.upsertHeartbeat or reliability.mjs, or (b) being declared in nex.worker_schedule (enabled=true).
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Worker</th>
            <th style={thStyle}>Verdict</th>
            {CRITERIA_ORDER.map((k) => (
              <th key={k} style={thNumStyle} title={CRITERIA_LABEL[k]}>{CRITERIA_LABEL[k]}</th>
            ))}
            <th style={thStyle}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((w) => {
            const style = VERDICT_STYLE[w.verdict];
            const expanded = expandedId === w.worker_id;
            return (
              <Fragment key={w.worker_id}>
                <tr
                  onClick={() => setExpandedId(expanded ? null : w.worker_id)}
                  style={{ cursor: "pointer", background: expanded ? "var(--nex-neutral-50, var(--nex-neutral-100))" : "transparent" }}
                >
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{w.worker_id}</td>
                  <td style={tdStyle}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "3px 10px", borderRadius: 999,
                      background: style.bg, color: style.text,
                      border: `1px solid ${style.border}`,
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {style.glyph} {style.label}
                    </span>
                  </td>
                  {CRITERIA_ORDER.map((k) => {
                    const c = w.criteria[k];
                    return (
                      <td key={k} style={tdNumStyle}>
                        <span style={{
                          fontFamily: "monospace",
                          color: c.passed ? "#047857" : "var(--nex-neutral-500)",
                          fontWeight: c.passed ? 700 : 500,
                        }} title={c.description}>
                          {c.passed ? "✓" : "·"} {c.count}
                        </span>
                      </td>
                    );
                  })}
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--nex-neutral-700)", maxWidth: 320 }}>{w.verdict_reason}</td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={CRITERIA_ORDER.length + 3} style={detailCellStyle}>
                      <EvidenceDetail evaluation={w} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <div style={hintStyle}>
        Click any row to expand full evidence · every criterion carries the exact SQL that produced its verdict.
      </div>
    </div>
  );
}

// ── Evidence detail panel ──────────────────────────────────────────────

function EvidenceDetail({ evaluation }: { evaluation: WorkerEvaluation }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "6px 4px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--nex-neutral-500)" }}>
        Evaluated at {new Date(evaluation.evaluated_at).toLocaleString("en-GB")}
      </div>
      {CRITERIA_ORDER.map((k) => (
        <CriterionCard key={k} criterion={evaluation.criteria[k]} />
      ))}
    </div>
  );
}

function CriterionCard({ criterion }: { criterion: CriterionResult }) {
  const c = criterion;
  return (
    <div style={{
      background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)",
      borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "var(--nex-neutral-900)" }}>
          {c.passed ? "✓ PASS" : "· FAIL"} · {CRITERIA_LABEL[c.key]}
        </div>
        <div style={{ fontSize: 11, color: "var(--nex-neutral-500)", fontVariantNumeric: "tabular-nums" }}>
          count = {c.count}
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--nex-neutral-700)" }}>{c.description}</div>
      <div style={{ fontSize: 11, color: "var(--nex-neutral-900)", fontStyle: "italic" }}>{c.reason}</div>
      {c.sql !== "n/a · derived from other criteria" && !c.sql.startsWith("n/a") && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--nex-neutral-500)", cursor: "pointer" }}>
            SQL evidence
          </summary>
          <pre style={sqlStyle}>{c.sql.trim()}</pre>
        </details>
      )}
      {c.evidence.length > 0 && (
        <details style={{ marginTop: 4 }} open>
          <summary style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--nex-neutral-500)", cursor: "pointer" }}>
            Sample rows ({c.evidence.length})
          </summary>
          <ul style={{ margin: "6px 0 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {c.evidence.map((e, i) => (
              <li key={i} style={{ fontSize: 11, fontFamily: "monospace", color: "var(--nex-neutral-800)", padding: "4px 8px", background: "var(--nex-neutral-100)", borderRadius: 4 }}>
                <span style={{ color: "var(--nex-neutral-500)", marginRight: 6 }}>{e.id}</span>
                {e.label}
                {e.timestamp && <span style={{ color: "var(--nex-neutral-500)", marginLeft: 6 }}>({e.timestamp})</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ── Styles · cream theme · matches workers/page.tsx tokens ─────────────

const panelStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 12, padding: "12px 16px", overflowX: "auto" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle: React.CSSProperties = { color: "var(--nex-neutral-500)", padding: "8px 8px 8px 0", textAlign: "left", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid var(--nex-neutral-200)" };
const thNumStyle: React.CSSProperties = { ...thStyle, textAlign: "right" };
const tdStyle: React.CSSProperties = { color: "var(--nex-neutral-900)", padding: "10px 8px 10px 0", verticalAlign: "top", borderTop: "1px solid var(--nex-neutral-100)" };
const tdNumStyle: React.CSSProperties = { ...tdStyle, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" };
const detailCellStyle: React.CSSProperties = { padding: "0 0 8px 0", background: "var(--nex-neutral-50, var(--nex-neutral-100))", borderTop: "1px solid var(--nex-neutral-200)" };
const sqlStyle: React.CSSProperties = { marginTop: 6, padding: "8px 10px", background: "var(--nex-neutral-100)", borderRadius: 4, fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", color: "var(--nex-neutral-800)", overflow: "auto" };
const hintStyle: React.CSSProperties = { marginTop: 8, fontSize: 11, color: "var(--nex-neutral-500)", fontStyle: "italic" };
