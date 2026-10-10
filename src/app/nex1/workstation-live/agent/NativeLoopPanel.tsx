"use client";

// src/app/nex1/workstation-live/agent/NativeLoopPanel.tsx
//
// NEX1 Native Programming Loop · workstation panel · zero LLM.
// Displays the real 10-stage trace from /api/nex1/native-loop/run.
// No fabricated progress. Every stage shows its actual verdict.

import { useCallback, useRef, useState } from "react";

type Verdict = "VERIFIED" | "PARTIAL" | "NOT_IMPLEMENTED" | "CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM" | "SKIPPED";

interface StageResult {
  stage: string;
  verdict: Verdict;
  summary: string;
  evidence: string[];
  reasoning_trace: string[];
  duration_ms: number;
}

interface LoopResult {
  loop_id: string;
  started_at: string;
  finished_at: string;
  founder_goal: string;
  target_test_file: string | null;
  target_line: number | null;
  stages: StageResult[];
  overall_verdict: Verdict;
  founder_summary: string;
  repo_root: string;
  baseline_test_result: { failing_tests: string[]; summary: string; exit_code: number | null } | null;
  final_test_result: { failing_tests: string[]; summary: string; exit_code: number | null } | null;
  capability_gaps: string[];
}

const STAGE_ORDER: readonly string[] = [
  "understand",
  "inspect",
  "reason",
  "plan",
  "change",
  "test",
  "diagnose",
  "repair",
  "verify",
  "learn",
];

const STAGE_LABEL: Record<string, string> = {
  understand: "1. UNDERSTAND",
  inspect: "2. INSPECT",
  reason: "3. REASON",
  plan: "4. PLAN",
  change: "5. CHANGE",
  test: "6. TEST",
  diagnose: "7. DIAGNOSE",
  repair: "8. REPAIR",
  verify: "9. VERIFY",
  learn: "10. LEARN",
};

export function NativeLoopPanel() {
  const [goal, setGoal] = useState(
    "Fix src/lib/nex-agent-runtime/__tests__/supervisor.test.ts:162 · S-5 expects handles.size===3 but got 2. Investigate root cause, propose repair, verify.",
  );
  const [target, setTarget] = useState("src/lib/nex-agent-runtime/__tests__/supervisor.test.ts");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LoopResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const run = useCallback(async () => {
    const g = goal.trim();
    if (!g || busy) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const r = await fetch("/api/nex1/native-loop/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ founder_goal: g, target_test_file: target.trim() || undefined }),
      });
      const j = (await r.json()) as { ok: boolean; result?: LoopResult; error?: string };
      if (j.ok && j.result) setResult(j.result);
      else setErr(j.error ?? "loop failed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }, [goal, target, busy]);

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.title}>NEX1 Native Programming Loop · zero LLM · deterministic composition</div>
        <div style={styles.subtitle}>
          Compose: UNDERSTAND → INSPECT → REASON → PLAN → CHANGE → TEST → DIAGNOSE → REPAIR → VERIFY → LEARN
        </div>
      </div>

      <div style={styles.form}>
        <label style={styles.label}>Founder goal</label>
        <textarea
          ref={taRef}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          style={styles.textarea}
          rows={3}
        />
        <label style={styles.label}>Target test file (optional · repo-relative)</label>
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          style={styles.input}
          placeholder="src/lib/.../__tests__/xxx.test.ts"
        />
        <div style={styles.row}>
          <button type="button" onClick={run} disabled={busy || !goal.trim()} style={styles.runBtn(busy || !goal.trim())}>
            {busy ? "Running loop…" : "Run native loop →"}
          </button>
          <span style={styles.hint}>
            Loop spawns real `vitest run`. Takes ~10–30s depending on target.
          </span>
        </div>
        {err && <div style={styles.err}>error · {err}</div>}
      </div>

      {result && (
        <div style={styles.result}>
          <div style={styles.resultHeader}>
            <span style={{ ...styles.verdictChip, background: verdictBg(result.overall_verdict) }}>
              {result.overall_verdict}
            </span>
            <span style={styles.loopId}>{result.loop_id}</span>
          </div>

          <p style={styles.summary}>{result.founder_summary}</p>

          {result.baseline_test_result && (
            <div style={styles.testBlock}>
              <div style={styles.testLabel}>Baseline vitest · exit {result.baseline_test_result.exit_code}</div>
              <div style={styles.testSummary}>{result.baseline_test_result.summary}</div>
              {result.baseline_test_result.failing_tests.length > 0 && (
                <ul style={styles.failList}>
                  {result.baseline_test_result.failing_tests.map((t, i) => (
                    <li key={i} style={styles.failItem}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div style={styles.stagesGrid}>
            {STAGE_ORDER.map((sName) => {
              const s = result.stages.find((x) => x.stage === sName);
              if (!s) return (
                <div key={sName} style={styles.stageMissing}>
                  <div style={styles.stageName}>{STAGE_LABEL[sName]}</div>
                  <div style={styles.stageMissingText}>(not reached)</div>
                </div>
              );
              return (
                <div key={sName} style={styles.stageCard}>
                  <div style={styles.stageHeader}>
                    <span style={styles.stageName}>{STAGE_LABEL[sName]}</span>
                    <span style={{ ...styles.stageChip, background: verdictBg(s.verdict) }}>
                      {shortVerdict(s.verdict)}
                    </span>
                    <span style={styles.stageMs}>{s.duration_ms}ms</span>
                  </div>
                  <div style={styles.stageSummary}>{s.summary}</div>
                  {s.evidence.length > 0 && (
                    <ul style={styles.evList}>
                      {s.evidence.slice(0, 6).map((e, i) => (
                        <li key={i} style={styles.evItem}>{e}</li>
                      ))}
                    </ul>
                  )}
                  {s.reasoning_trace.length > 0 && (
                    <details style={styles.trace}>
                      <summary style={styles.traceSummary}>reasoning trace ({s.reasoning_trace.length})</summary>
                      <ul style={styles.traceList}>
                        {s.reasoning_trace.map((t, i) => (
                          <li key={i} style={styles.traceItem}>{t}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}
          </div>

          {result.capability_gaps.length > 0 && (
            <div style={styles.gapsBlock}>
              <div style={styles.gapsHeader}>Capability gaps identified (deterministic path required · no LLM)</div>
              <ul style={styles.gapsList}>
                {result.capability_gaps.map((g, i) => (
                  <li key={i} style={styles.gapItem}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function verdictBg(v: Verdict): string {
  switch (v) {
    case "VERIFIED": return "#166534";
    case "PARTIAL": return "#B45309";
    case "NOT_IMPLEMENTED": return "#374151";
    case "CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM": return "#7C2D12";
    case "SKIPPED": return "#1E293B";
  }
}

function shortVerdict(v: Verdict): string {
  if (v === "CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM") return "GAP · no LLM";
  return v.replace(/_/g, " ").toLowerCase();
}

const styles = {
  root: { display: "flex" as const, flexDirection: "column" as const, height: "100%", minHeight: 0, overflowY: "auto" as const, padding: 14 },
  header: { marginBottom: 12 },
  title: { fontSize: 13, fontWeight: 700, color: "#22D3EE", letterSpacing: "0.04em" },
  subtitle: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  form: { marginBottom: 16 },
  label: { display: "block", fontSize: 10, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginTop: 10, marginBottom: 4 },
  textarea: {
    width: "100%", boxSizing: "border-box" as const,
    background: "#0B1220", color: "#F9FAFB",
    border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px",
    fontSize: 12, fontFamily: "Inter, system-ui, sans-serif", resize: "none" as const, outline: "none", minHeight: 60,
  },
  input: {
    width: "100%", boxSizing: "border-box" as const,
    background: "#0B1220", color: "#F9FAFB",
    border: "1px solid #1E293B", borderRadius: 8, padding: "8px 10px",
    fontSize: 12, fontFamily: "'JetBrains Mono', monospace", outline: "none",
  },
  row: { marginTop: 10, display: "flex", alignItems: "center", gap: 12 },
  hint: { color: "#64748B", fontSize: 11 },
  runBtn: (disabled: boolean) => ({
    background: disabled ? "#1E293B" : "#22D3EE",
    color: disabled ? "#64748B" : "#0B1220",
    border: "none", borderRadius: 8, padding: "8px 14px",
    fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
    cursor: disabled ? "not-allowed" : "pointer",
  }),
  err: { marginTop: 10, color: "#FCA5A5", fontSize: 12 },
  result: { marginTop: 8, borderTop: "1px solid #1E293B", paddingTop: 12 },
  resultHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  verdictChip: { fontSize: 10, fontWeight: 700, color: "#F9FAFB", padding: "4px 10px", borderRadius: 6, letterSpacing: "0.04em" },
  loopId: { fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" },
  summary: { fontSize: 13, lineHeight: 1.5, color: "#E5E7EB", margin: "0 0 12px 0" },
  testBlock: { background: "#0B1220", border: "1px solid #1E293B", borderRadius: 8, padding: 10, marginBottom: 12 },
  testLabel: { fontSize: 11, color: "#22D3EE", fontFamily: "'JetBrains Mono', monospace" },
  testSummary: { fontSize: 12, color: "#E5E7EB", marginTop: 4 },
  failList: { margin: "6px 0 0 0", padding: "0 0 0 20px" },
  failItem: { fontSize: 11, color: "#FCA5A5" },
  stagesGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBottom: 12 },
  stageCard: { background: "#0B1220", border: "1px solid #1E293B", borderRadius: 8, padding: 10 },
  stageMissing: { background: "#0B1220", border: "1px dashed #1E293B", borderRadius: 8, padding: 10, opacity: 0.5 },
  stageMissingText: { fontSize: 11, color: "#64748B", fontStyle: "italic" as const, marginTop: 4 },
  stageHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  stageName: { fontSize: 11, fontWeight: 700, color: "#E5E7EB", fontFamily: "'JetBrains Mono', monospace" },
  stageChip: { fontSize: 9, fontWeight: 700, color: "#F9FAFB", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  stageMs: { marginLeft: "auto", fontSize: 10, color: "#64748B" },
  stageSummary: { fontSize: 12, color: "#CBD5E1", lineHeight: 1.4 },
  evList: { margin: "6px 0 0 0", padding: "0 0 0 20px" },
  evItem: { fontSize: 11, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.4 },
  trace: { marginTop: 6 },
  traceSummary: { fontSize: 10, color: "#64748B", cursor: "pointer" },
  traceList: { margin: "4px 0 0 0", padding: "0 0 0 20px" },
  traceItem: { fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" },
  gapsBlock: { background: "rgba(124, 45, 18, 0.2)", border: "1px solid rgba(124, 45, 18, 0.6)", borderRadius: 8, padding: 10 },
  gapsHeader: { fontSize: 11, fontWeight: 700, color: "#FCA5A5", marginBottom: 6 },
  gapsList: { margin: 0, padding: "0 0 0 20px" },
  gapItem: { fontSize: 11, color: "#E5E7EB", lineHeight: 1.4, marginBottom: 4 },
} as const;
