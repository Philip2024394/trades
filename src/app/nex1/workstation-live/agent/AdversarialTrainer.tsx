"use client";

// src/app/nexapp/nex-agent/AdversarialTrainer.tsx
//
// NEX1 · ADVERSARIAL TRAINER · workstation LEFT panel below the Capability Ladder.
//
// Founder directive (2026-09-11):
//   "produce complex mock code in all file formats and situations to try get
//    nex1 to fail a task · and if fail then teach nex1 the code solution until
//    master coder ai."
//
// This panel:
//   · reads corpus + history from /api/nex/agent/training/adversarial
//   · shows total lessons · passed · partial · failed · untried
//   · surfaces the next-up untried lessons so NEX1 has a queue
//   · lets founder click a lesson to see its trap code + expected failure signals
//     + corrected solution + teaching text (i.e. the exact material NEX1 must learn)
//
// Attempts are recorded via POST when NEX1 (or a manual founder-run) submits.
// Every pass bumps the Capability Ladder through the competency-events ledger.

import { useEffect, useState } from "react";

interface LessonMeta {
  id: string;
  title: string;
  category: string;
  format: string;
  difficulty: number;
  guard: string;
  filePathHint: string;
  competencyDomains: readonly string[];
}
interface HistoryRow {
  lesson_id: string;
  verdict: "pass" | "partial" | "fail";
  recorded_at: string;
  attempts: number;
}
interface CorpusPayload {
  stats: {
    total: number;
    byGuard: Record<string, number>;
    byFormat: Record<string, number>;
    byDifficulty: Record<string, number>;
  };
  history: HistoryRow[];
  summary: {
    total: number;
    passed: number;
    partial: number;
    failed: number;
    untried: number;
    pass_rate_pct: number;
  };
  untried_next_up: Array<{ id: string; title: string; difficulty: number; guard: string; format: string }>;
  lessons: LessonMeta[];
}
interface LessonDetail extends LessonMeta {
  mockFailingCode: string;
  expectedFailureSignals: readonly string[];
  correctedSolution: string;
  teaching: string;
}

const GUARD_COLORS: Record<string, string> = {
  guardian: "#F97316",
  security: "#EF4444",
  ui_dna: "#EAB308",
  truth_engine: "#22D3EE",
  type_check: "#8B5CF6",
  hooks_lint: "#22C55E",
  doctrine: "#DC2626",
  test_runner: "#22D3EE",
  a11y: "#EAB308",
};

const FORMAT_LABELS: Record<string, string> = {
  tsx: "TSX", ts: "TS", js: "JS", sql: "SQL", json: "JSON",
  yaml: "YAML", css: "CSS", bash: "SH", powershell: "PS1",
  markdown: "MD", dockerfile: "DOCKER", env: "ENV",
};

interface AttemptResult {
  verdict: "pass" | "partial" | "fail";
  matchedSignals: string[];
  missedSignals: string[];
  notes: string;
  ledger_recorded: boolean;
  at: string;
}

export function AdversarialTrainer() {
  const [corpus, setCorpus] = useState<CorpusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LessonDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState<boolean>(false);
  // Attempt state · per-lesson
  const [attemptDiagnosis, setAttemptDiagnosis] = useState<string>("");
  const [attemptCode, setAttemptCode] = useState<string>("");
  const [attemptedBy, setAttemptedBy] = useState<string>("nex1");
  const [attemptBusy, setAttemptBusy] = useState<boolean>(false);
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  // Runner state · autonomous Master AI training loop
  const [runnerBusy, setRunnerBusy] = useState<boolean>(false);
  const [runnerSummary, setRunnerSummary] = useState<string | null>(null);
  const startRunner = async (limit: number) => {
    if (runnerBusy) return;
    setRunnerBusy(true);
    setRunnerSummary(null);
    try {
      const r = await fetch("/api/nex/agent/training/adversarial/runner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "run-all", limit }),
      });
      const j = await r.json() as { ok: boolean; ran?: number; passed?: number; partial?: number; failed?: number; error?: string };
      if (j.ok) {
        setRunnerSummary(`Ran ${j.ran} · ${j.passed}✓ · ${j.partial ?? 0}⌇ · ${j.failed ?? 0}✗`);
        void load();
        try { window.dispatchEvent(new CustomEvent("nex1:capability:refresh")); } catch { /* SSR guard */ }
      } else {
        setRunnerSummary(`runner error · ${j.error ?? "unknown"}`);
      }
    } catch (e) {
      setRunnerSummary(e instanceof Error ? e.message.slice(0, 100) : "network error");
    } finally {
      setRunnerBusy(false);
    }
  };

  const load = async (): Promise<void> => {
    try {
      const r = await fetch("/api/nex/agent/training/adversarial", { cache: "no-store" });
      if (!r.ok) { setError(`corpus ${r.status}`); return; }
      const j = (await r.json()) as { ok: boolean; corpus?: CorpusPayload; error?: string };
      if (j.ok && j.corpus) { setCorpus(j.corpus); setError(null); }
      else setError(j.error ?? "no corpus");
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 60) : "fetch failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(t);
  }, []);

  const openLesson = async (id: string) => {
    setSelectedId(id);
    setDetailBusy(true);
    setDetail(null);
    setAttemptDiagnosis("");
    setAttemptCode("");
    setAttemptResult(null);
    setAttemptError(null);
    try {
      const r = await fetch(`/api/nex/agent/training/adversarial?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = (await r.json()) as { ok: boolean; lesson?: LessonDetail };
      if (j.ok && j.lesson) setDetail(j.lesson);
    } finally {
      setDetailBusy(false);
    }
  };

  const submitAttempt = async () => {
    if (!selectedId || !attemptDiagnosis.trim() || attemptBusy) return;
    setAttemptBusy(true);
    setAttemptError(null);
    setAttemptResult(null);
    try {
      const r = await fetch("/api/nex/agent/training/adversarial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lesson_id: selectedId,
          diagnosis: attemptDiagnosis,
          corrected_code: attemptCode,
          attempted_by: attemptedBy || "nex1",
        }),
      });
      const j = await r.json() as { ok: boolean; grade?: AttemptResult; ledger_recorded?: boolean; error?: string };
      if (!j.ok || !j.grade) {
        setAttemptError(j.error ?? "attempt failed");
      } else {
        setAttemptResult({
          verdict: j.grade.verdict,
          matchedSignals: j.grade.matchedSignals,
          missedSignals: j.grade.missedSignals,
          notes: j.grade.notes,
          ledger_recorded: !!j.ledger_recorded,
          at: new Date().toISOString(),
        });
        // Refresh the corpus so history + summary reflect the new attempt
        void load();
        // Tell the Capability Ladder to re-poll immediately · bar moves without waiting for the 20 s tick
        try { window.dispatchEvent(new CustomEvent("nex1:capability:refresh")); } catch { /* SSR guard */ }
      }
    } catch (e) {
      setAttemptError(e instanceof Error ? e.message.slice(0, 100) : "network error");
    } finally {
      setAttemptBusy(false);
    }
  };

  const historyMap = new Map<string, HistoryRow>();
  corpus?.history.forEach((h) => historyMap.set(h.lesson_id, h));

  const s = corpus?.summary;
  const passPct = s ? Math.round((s.passed / Math.max(1, s.total)) * 100) : 0;

  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(11, 18, 32, 0.92))",
      border: "1px solid rgba(239, 68, 68, 0.28)",
      borderRadius: 12, padding: 12,
      boxShadow: "0 0 12px rgba(239, 68, 68, 0.15)",
      fontFamily: "Inter, system-ui, sans-serif",
      color: "#F9FAFB",
      marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, filter: "drop-shadow(0 0 6px #EF4444)" }} aria-hidden="true">⚔</span>
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#EF4444", fontWeight: 800 }}>
              Adversarial Trainer
            </div>
            <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
              Trap code · every format · until NEX1 can't be broken
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          style={{
            background: "transparent", border: "1px solid rgba(239, 68, 68, 0.5)", borderRadius: 6,
            color: "#EF4444", fontSize: 10, padding: "3px 7px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
          }}
          aria-label={collapsed ? "Expand" : "Collapse"}
        >{collapsed ? "▸" : "▾"}</button>
      </div>

      {loading && !corpus && (
        <div style={{ fontSize: 11, color: "#94A3B8", padding: "12px 0", textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}>
          loading corpus…
        </div>
      )}

      {error && !corpus && !loading && (
        <div style={{ fontSize: 10, color: "#F59E0B", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.28)", borderRadius: 6, padding: 8, fontFamily: "'JetBrains Mono', monospace" }}>
          {error}
        </div>
      )}

      {corpus && (
        <>
          {/* Summary counters */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
            <div style={{ background: "rgba(148, 163, 184, 0.08)", borderRadius: 5, padding: "5px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#94A3B8", textTransform: "uppercase" }}>Corpus</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#F9FAFB" }}>{s?.total ?? 0}</div>
            </div>
            <div style={{ background: "rgba(34, 197, 94, 0.10)", borderRadius: 5, padding: "5px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#94A3B8", textTransform: "uppercase" }}>Passed</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#22C55E" }}>{s?.passed ?? 0}</div>
            </div>
            <div style={{ background: "rgba(245, 158, 11, 0.10)", borderRadius: 5, padding: "5px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#94A3B8", textTransform: "uppercase" }}>Partial</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#F59E0B" }}>{s?.partial ?? 0}</div>
            </div>
            <div style={{ background: "rgba(239, 68, 68, 0.10)", borderRadius: 5, padding: "5px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#94A3B8", textTransform: "uppercase" }}>Failed</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#EF4444" }}>{s?.failed ?? 0}</div>
            </div>
          </div>

          {/* Mastery bar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 3, fontFamily: "'JetBrains Mono', monospace" }}>
              <span style={{ color: "#94A3B8", textTransform: "uppercase" }}>Corpus mastery</span>
              <span style={{ color: "#22C55E", fontWeight: 700 }}>{passPct}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(148, 163, 184, 0.12)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${passPct}%`,
                background: "linear-gradient(90deg, rgba(34, 197, 94, 0.4), #22C55E)",
                transition: "width 0.6s ease",
                boxShadow: passPct > 0 ? "0 0 8px #22C55E88" : "none",
              }} />
            </div>
          </div>

          {/* Runner controls · autonomous Master AI training loop */}
          <div style={{
            marginBottom: 10, padding: 6,
            background: "rgba(249, 115, 22, 0.06)",
            border: "1px solid rgba(249, 115, 22, 0.28)",
            borderRadius: 6,
          }}>
            <div style={{
              fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em",
              color: "#F97316", fontWeight: 700, marginBottom: 4,
              fontFamily: "'JetBrains Mono', monospace",
            }}>Autonomous training runner · Master AI attests</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                onClick={() => void startRunner(5)}
                disabled={runnerBusy}
                style={{
                  flex: 1,
                  background: runnerBusy ? "rgba(148, 163, 184, 0.12)" : "linear-gradient(180deg, #F97316, #EA580C)",
                  border: "1px solid rgba(249, 115, 22, 0.55)",
                  borderRadius: 4, padding: "5px 8px",
                  color: runnerBusy ? "#94A3B8" : "white",
                  fontSize: 10, fontWeight: 800,
                  cursor: runnerBusy ? "not-allowed" : "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}
              >{runnerBusy ? "running…" : "🚀 Run 5"}</button>
              <button
                type="button"
                onClick={() => void startRunner(45)}
                disabled={runnerBusy}
                style={{
                  flex: 1,
                  background: runnerBusy ? "rgba(148, 163, 184, 0.12)" : "linear-gradient(180deg, #22C55E, #16A34A)",
                  border: "1px solid rgba(34, 197, 94, 0.55)",
                  borderRadius: 4, padding: "5px 8px",
                  color: runnerBusy ? "#94A3B8" : "white",
                  fontSize: 10, fontWeight: 800,
                  cursor: runnerBusy ? "not-allowed" : "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}
              >{runnerBusy ? "running…" : "🎯 Run all"}</button>
            </div>
            {runnerSummary && (
              <div style={{
                marginTop: 5, fontSize: 9, color: "#22C55E",
                fontFamily: "'JetBrains Mono', monospace",
                background: "rgba(34, 197, 94, 0.08)",
                border: "1px solid rgba(34, 197, 94, 0.28)",
                borderRadius: 3, padding: "3px 5px",
              }}>{runnerSummary}</div>
            )}
            <div style={{ marginTop: 4, fontSize: 8, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
              Prioritises lessons targeting unfilled competencies · bar moves live
            </div>
          </div>

          {!collapsed && (
            <>
              {/* Next-up queue */}
              {corpus.untried_next_up.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em", color: "#F97316", fontWeight: 700, marginBottom: 4 }}>
                    Next up · untried lessons
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {corpus.untried_next_up.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => void openLesson(l.id)}
                        style={{
                          background: selectedId === l.id ? "rgba(34, 211, 238, 0.12)" : "rgba(148, 163, 184, 0.06)",
                          border: `1px solid ${selectedId === l.id ? "rgba(34, 211, 238, 0.5)" : "rgba(148, 163, 184, 0.2)"}`,
                          borderRadius: 5, padding: "5px 7px", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 6,
                          fontFamily: "'JetBrains Mono', monospace", color: "#F9FAFB",
                          textAlign: "left",
                        }}
                      >
                        <span style={{
                          background: `${GUARD_COLORS[l.guard] ?? "#94A3B8"}22`,
                          border: `1px solid ${GUARD_COLORS[l.guard] ?? "#94A3B8"}55`,
                          color: GUARD_COLORS[l.guard] ?? "#94A3B8",
                          borderRadius: 3, padding: "1px 4px", fontSize: 8, fontWeight: 800,
                          textTransform: "uppercase",
                        }}>{FORMAT_LABELS[l.format] ?? l.format}</span>
                        <span style={{ fontSize: 9, color: "#94A3B8", width: 18 }}>D{l.difficulty}</span>
                        <span style={{ flex: 1, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.id} · {l.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Complete corpus list · compact scroll */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em", color: "#22D3EE", fontWeight: 700, marginBottom: 4 }}>
                  Full corpus · {corpus.lessons.length} lessons
                </div>
                <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, paddingRight: 2 }}>
                  {corpus.lessons.map((l) => {
                    const h = historyMap.get(l.id);
                    const dotColor = h?.verdict === "pass" ? "#22C55E" : h?.verdict === "partial" ? "#F59E0B" : h?.verdict === "fail" ? "#EF4444" : "#64748B";
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => void openLesson(l.id)}
                        style={{
                          background: selectedId === l.id ? "rgba(34, 211, 238, 0.10)" : "transparent",
                          border: `1px solid ${selectedId === l.id ? "rgba(34, 211, 238, 0.4)" : "transparent"}`,
                          borderRadius: 4, padding: "3px 5px", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 5,
                          fontFamily: "'JetBrains Mono', monospace", color: "#F9FAFB",
                          textAlign: "left", fontSize: 9,
                        }}
                      >
                        <span style={{
                          width: 6, height: 6, borderRadius: 3, background: dotColor,
                          boxShadow: h?.verdict === "pass" ? `0 0 4px ${dotColor}` : "none",
                          flexShrink: 0,
                        }} />
                        <span style={{ color: GUARD_COLORS[l.guard] ?? "#94A3B8", width: 32, fontSize: 8, fontWeight: 800 }}>
                          {FORMAT_LABELS[l.format] ?? l.format}
                        </span>
                        <span style={{ color: "#94A3B8", width: 32 }}>{l.id}</span>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</span>
                        {h && <span style={{ fontSize: 8, color: dotColor, fontWeight: 700 }}>{h.attempts}×</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected lesson detail */}
              {selectedId && (
                <div style={{
                  background: "rgba(0, 0, 0, 0.35)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  borderRadius: 6, padding: 8,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {detailBusy && <div style={{ fontSize: 10, color: "#94A3B8" }}>loading lesson…</div>}
                  {detail && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                        <div style={{ fontSize: 10, color: "#EF4444", fontWeight: 800 }}>{detail.id} · {detail.title}</div>
                        <button
                          type="button"
                          onClick={() => { setSelectedId(null); setDetail(null); }}
                          style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 12 }}
                          aria-label="Close"
                        >✕</button>
                      </div>
                      <div style={{ fontSize: 9, color: "#94A3B8", marginBottom: 6 }}>
                        {detail.category} · D{detail.difficulty} · guard={detail.guard} · file={detail.filePathHint}
                      </div>

                      <div style={{ fontSize: 8, textTransform: "uppercase", color: "#EF4444", fontWeight: 700, marginBottom: 3 }}>Trap code</div>
                      <pre style={{
                        background: "rgba(239, 68, 68, 0.06)",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                        borderRadius: 4, padding: 6,
                        fontSize: 9, color: "#F9FAFB",
                        overflowX: "auto", maxHeight: 160,
                        margin: 0, marginBottom: 6, whiteSpace: "pre",
                      }}>{detail.mockFailingCode}</pre>

                      <div style={{ fontSize: 8, textTransform: "uppercase", color: "#F97316", fontWeight: 700, marginBottom: 3 }}>Expected failure signals</div>
                      <ul style={{ margin: 0, marginBottom: 6, paddingLeft: 14, fontSize: 9, color: "#F9FAFB" }}>
                        {detail.expectedFailureSignals.map((s, i) => (<li key={i}>{s}</li>))}
                      </ul>

                      <div style={{ fontSize: 8, textTransform: "uppercase", color: "#22C55E", fontWeight: 700, marginBottom: 3 }}>Corrected solution</div>
                      <pre style={{
                        background: "rgba(34, 197, 94, 0.06)",
                        border: "1px solid rgba(34, 197, 94, 0.24)",
                        borderRadius: 4, padding: 6,
                        fontSize: 9, color: "#F9FAFB",
                        overflowX: "auto", maxHeight: 160,
                        margin: 0, marginBottom: 6, whiteSpace: "pre",
                      }}>{detail.correctedSolution}</pre>

                      <div style={{ fontSize: 8, textTransform: "uppercase", color: "#22D3EE", fontWeight: 700, marginBottom: 3 }}>Teaching</div>
                      <div style={{ fontSize: 10, color: "#F9FAFB", lineHeight: 1.4, fontFamily: "Inter, system-ui, sans-serif", marginBottom: 8 }}>
                        {detail.teaching}
                      </div>

                      {/* Attempt · closes the training loop */}
                      <div style={{
                        marginTop: 8, paddingTop: 8,
                        borderTop: "1px dashed rgba(34, 211, 238, 0.35)",
                      }}>
                        <div style={{ fontSize: 8, textTransform: "uppercase", color: "#F97316", fontWeight: 700, marginBottom: 4 }}>
                          Record NEX1 attempt · bar rises on pass
                        </div>
                        <label style={{ display: "block", fontSize: 8, color: "#94A3B8", marginBottom: 2, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>Diagnosis · what did NEX1 identify?</label>
                        <textarea
                          value={attemptDiagnosis}
                          onChange={(e) => setAttemptDiagnosis(e.target.value)}
                          rows={2}
                          placeholder="Signals NEX1 spotted · comma-separated · e.g. hook order · conditional useMemo"
                          style={{
                            width: "100%", boxSizing: "border-box",
                            background: "rgba(0, 0, 0, 0.4)",
                            border: "1px solid rgba(148, 163, 184, 0.28)",
                            borderRadius: 4, padding: 5,
                            color: "#F9FAFB", fontSize: 9,
                            fontFamily: "'JetBrains Mono', monospace",
                            resize: "vertical", marginBottom: 4,
                          }}
                        />
                        <label style={{ display: "block", fontSize: 8, color: "#94A3B8", marginBottom: 2, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>Corrected code · optional</label>
                        <textarea
                          value={attemptCode}
                          onChange={(e) => setAttemptCode(e.target.value)}
                          rows={3}
                          placeholder="Paste NEX1's corrected version. Overlap with the reference solution counts toward the pass verdict."
                          style={{
                            width: "100%", boxSizing: "border-box",
                            background: "rgba(0, 0, 0, 0.4)",
                            border: "1px solid rgba(148, 163, 184, 0.28)",
                            borderRadius: 4, padding: 5,
                            color: "#F9FAFB", fontSize: 9,
                            fontFamily: "'JetBrains Mono', monospace",
                            resize: "vertical", marginBottom: 4,
                          }}
                        />
                        <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
                          <select
                            value={attemptedBy}
                            onChange={(e) => setAttemptedBy(e.target.value)}
                            style={{
                              background: "rgba(0, 0, 0, 0.5)",
                              border: "1px solid rgba(148, 163, 184, 0.3)",
                              borderRadius: 4, padding: "3px 5px",
                              color: "#F9FAFB", fontSize: 9,
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            <option value="nex1">nex1</option>
                            <option value="master-ai">master-ai</option>
                            <option value="claude">claude</option>
                            <option value="founder">founder</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => void submitAttempt()}
                            disabled={attemptBusy || !attemptDiagnosis.trim()}
                            style={{
                              flex: 1,
                              background: attemptBusy ? "rgba(148, 163, 184, 0.15)" : "linear-gradient(180deg, #F97316, #EA580C)",
                              border: "1px solid rgba(249, 115, 22, 0.55)",
                              borderRadius: 4, padding: "4px 8px",
                              color: attemptBusy ? "#94A3B8" : "white",
                              fontSize: 10, fontWeight: 800,
                              cursor: attemptBusy || !attemptDiagnosis.trim() ? "not-allowed" : "pointer",
                              opacity: !attemptDiagnosis.trim() ? 0.5 : 1,
                              fontFamily: "'JetBrains Mono', monospace",
                              textTransform: "uppercase", letterSpacing: "0.05em",
                            }}
                          >{attemptBusy ? "grading…" : "Grade attempt →"}</button>
                        </div>
                        {attemptError && (
                          <div style={{
                            fontSize: 9, color: "#EF4444",
                            background: "rgba(239, 68, 68, 0.08)",
                            border: "1px solid rgba(239, 68, 68, 0.28)",
                            borderRadius: 4, padding: 5, marginBottom: 4,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}>{attemptError}</div>
                        )}
                        {attemptResult && (
                          <div style={{
                            background: attemptResult.verdict === "pass" ? "rgba(34, 197, 94, 0.10)"
                              : attemptResult.verdict === "partial" ? "rgba(245, 158, 11, 0.10)"
                              : "rgba(239, 68, 68, 0.10)",
                            border: `1px solid ${
                              attemptResult.verdict === "pass" ? "rgba(34, 197, 94, 0.5)"
                              : attemptResult.verdict === "partial" ? "rgba(245, 158, 11, 0.5)"
                              : "rgba(239, 68, 68, 0.5)"
                            }`,
                            borderRadius: 4, padding: 6,
                          }}>
                            <div style={{
                              fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                              color: attemptResult.verdict === "pass" ? "#22C55E"
                                : attemptResult.verdict === "partial" ? "#F59E0B" : "#EF4444",
                              fontFamily: "'JetBrains Mono', monospace",
                              marginBottom: 3,
                            }}>
                              Verdict · {attemptResult.verdict}
                              {attemptResult.ledger_recorded && (
                                <span style={{ marginLeft: 6, fontSize: 8, color: "#22C55E" }}>· ledger ✓</span>
                              )}
                            </div>
                            <div style={{ fontSize: 9, color: "#F9FAFB", fontFamily: "'JetBrains Mono', monospace", marginBottom: 3 }}>
                              {attemptResult.notes}
                            </div>
                            {attemptResult.matchedSignals.length > 0 && (
                              <div style={{ fontSize: 9, color: "#22C55E", fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>
                                ✓ matched: {attemptResult.matchedSignals.join(" · ")}
                              </div>
                            )}
                            {attemptResult.missedSignals.length > 0 && (
                              <div style={{ fontSize: 9, color: "#F59E0B", fontFamily: "'JetBrains Mono', monospace" }}>
                                ○ missed: {attemptResult.missedSignals.join(" · ")}
                              </div>
                            )}
                            {attemptResult.verdict !== "pass" && detail && (
                              <div style={{ marginTop: 4, fontSize: 9, color: "#22D3EE", fontStyle: "italic", fontFamily: "Inter, system-ui, sans-serif" }}>
                                Re-read the teaching above · retry with the missed signals included.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
