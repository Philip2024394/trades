"use client";

// src/app/nexapp/nex-agent/training/TrainingRoomClient.tsx
//
// NEX Agent v1.1-T · Training Room UI.
// Founder picks a lesson · presses "nex1 attempts" · sees the deterministic score ·
// reviews · promotes learnings to the doctrine ledger.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Lesson { lesson_id: string; created_at: string; lesson_key: string; lesson_kind: string; title: string; description: string; material: Record<string, unknown>; expected_answer: Record<string, unknown>; passing_criteria: Record<string, unknown>; difficulty: string; curated_by: string; }
interface Attempt { attempt_id: string; lesson_id: string; attempted_at: string; attempted_by: string; submitted_answer: Record<string, unknown>; auto_score: number | null; auto_verdict: string | null; auto_findings: Array<{ severity: string; rule: string; detail: string }> | null; mentor_reviewed_at: string | null; mentor_verdict: string | null; mentor_notes: string | null; }
interface Doctrine { doctrine_id: string; created_at: string; doctrine_key: string; doctrine_text: string; severity: string; promoted_by: string; source_lesson_id: string | null; }
interface Competency { competency_id: string; domain_key: string; domain_label: string; description: string | null; target_score: number; achieved_score: number; required_for_tier: "LOW" | "MEDIUM" | "HIGH"; last_updated_at: string; }
interface Autonomy { tier: "LOW" | "MEDIUM" | "HIGH"; next_tier: "LOW" | "MEDIUM" | "HIGH" | null; next_tier_gap: Array<{ domain_key: string; domain_label: string; achieved: number; target: number; deficit: number }>; totals: { total_domains: number; at_target: number; low_ready: boolean; medium_ready: boolean; high_ready: boolean }; by_tier: Record<string, { total: number; at_target: number; percent: number }>; }
interface Project { project_id: string; project_key: string; title: string; description: string; difficulty: string; unseen_evaluation: boolean; competency_domains: string[]; milestones: Array<{ id: string; name: string; kind: string }>; }
interface ProjectAttempt { attempt_id: string; project_id: string; attempted_at: string; overall_score: number; overall_verdict: string; unseen_evaluation: boolean; duration_ms: number; milestone_results: Array<{ milestone_id: string; name: string; kind: string; auto: { score: number; verdict: string } }>; }
interface AutonomySignal { key: string; label: string; category: string; value: number; raw: string; tier_impact: string; higher_is_worse?: boolean; notes?: string; }
interface AutonomyDashboardData { computed_at: string; tier: string; next_tier: string | null; signals: AutonomySignal[]; unseen_family_coverage: Array<{ family: string; passed: number; total_available: number }>; gates: Record<string, boolean>; next_tier_gap: string[]; }
interface Payload { ok: boolean; lessons: Lesson[]; attempts: Attempt[]; doctrine: Doctrine[]; competencies?: Competency[]; autonomy?: Autonomy; projects?: Project[]; project_attempts?: ProjectAttempt[]; autonomy_dashboard?: AutonomyDashboardData; error?: string; }

const VERDICT_COLOUR: Record<string, string> = { pass: "#4ade80", partial: "#facc15", fail: "#f87171", error: "#f87171", needs_revision: "#facc15" };
const SEVERITY_COLOUR: Record<string, string> = { forbidden: "#f87171", mandatory: "#facc15", guidance: "#38bdf8" };
const TIER_COLOUR: Record<string, string> = { LOW: "#f87171", MEDIUM: "#facc15", HIGH: "#4ade80" };

export function TrainingRoomClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<{ attempt_id: string; submitted_answer: Record<string, unknown>; auto: { score: number; verdict: string; findings: Array<{ severity: string; rule: string; detail: string }> } } | null>(null);
  const [reviewForm, setReviewForm] = useState<{ verdict: string; notes: string; doctrine_key: string; doctrine_text: string; severity: string } | null>(null);
  const [activeSection, setActiveSection] = useState<"lessons" | "projects" | "autonomy">("autonomy");
  const [autonomyData, setAutonomyData] = useState<AutonomyDashboardData | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectRunning, setProjectRunning] = useState(false);
  const [lastProjectResult, setLastProjectResult] = useState<{ attempt_id: string; result: ProjectAttempt; competency_bumps: Array<{ domain: string; delta: number; reason: string }> } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const r = await fetch("/api/nex/agent/training", { cache: "no-store", signal });
      const j = await r.json();
      if (!signal?.aborted) { setData(j); setErr(j.error ?? null); }
    } catch (e) {
      if (signal?.aborted) return;
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErr(e instanceof Error ? e.message.slice(0, 80) : "err");
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    const iv = setInterval(() => { void load(ac.signal); }, 6000);
    return () => { ac.abort(); clearInterval(iv); };
  }, [load]);

  useEffect(() => {
    const ac = new AbortController();
    const fetchAutonomy = async () => {
      try {
        const r = await fetch("/api/nex/agent/autonomy", { cache: "no-store", signal: ac.signal });
        if (!r.ok) return;
        const j = await r.json();
        if (j.ok && j.dashboard) setAutonomyData(j.dashboard);
      } catch { /* transient */ }
    };
    void fetchAutonomy();
    const iv = setInterval(fetchAutonomy, 10000);
    return () => { ac.abort(); clearInterval(iv); };
  }, []);

  const active = data?.lessons.find(l => l.lesson_id === activeLessonId) ?? null;
  const attemptsForActive = data?.attempts.filter(a => a.lesson_id === activeLessonId) ?? [];

  async function attempt() {
    if (!active || running) return;
    setRunning(true); setErr(null); setLastAttempt(null);
    try {
      const r = await fetch("/api/nex/agent/training", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "attempt", lesson_id: active.lesson_id }) });
      const j = await r.json();
      if (j.ok) { setLastAttempt({ attempt_id: j.attempt_id, submitted_answer: j.submitted_answer, auto: j.auto }); void load(); }
      else setErr(j.error || "attempt_failed");
    } catch (e) { setErr(e instanceof Error ? e.message : "err"); }
    finally { setRunning(false); }
  }

  async function review(attemptId: string, verdict: string, notes: string) {
    await fetch("/api/nex/agent/training", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "review", attempt_id: attemptId, verdict, notes }) });
    void load();
  }
  async function attemptProjectRun() {
    if (!activeProjectId || projectRunning) return;
    setProjectRunning(true); setErr(null); setLastProjectResult(null);
    try {
      const r = await fetch("/api/nex/agent/training", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "attempt_project", project_id: activeProjectId }) });
      const j = await r.json();
      if (j.ok) { setLastProjectResult({ attempt_id: j.attempt_id, result: j.result, competency_bumps: j.competency_bumps ?? [] }); void load(); }
      else setErr(j.error || "attempt_project_failed");
    } catch (e) { setErr(e instanceof Error ? e.message : "err"); }
    finally { setProjectRunning(false); }
  }

  async function promote() {
    if (!reviewForm || !active) return;
    const r = await fetch("/api/nex/agent/training", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "promote", doctrine_key: reviewForm.doctrine_key, doctrine_text: reviewForm.doctrine_text, severity: reviewForm.severity, source_lesson_id: active.lesson_id, promoted_by: "founder" }) });
    const j = await r.json();
    if (j.ok) { setReviewForm(null); void load(); }
    else setErr(j.error || "promote_failed");
  }

  return (
    <div style={page}>
      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "#38bdf8", boxShadow: "0 0 8px #38bdf888" }} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>NEX Agent · Training Room</div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>V1.1-T · nex1 learns the NEX way before self-repair</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/nexapp/nex-agent" style={navLink}>← Agent</Link>
          <Link href="/nexapp/hq" style={navLink}>HQ</Link>
        </div>
      </header>

      <div style={body}>
        {/* Left · lessons / projects catalog */}
        <aside style={{ ...aside, borderRight: "1px solid #1e293b", borderLeft: "none" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #1e293b", display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button onClick={() => setActiveSection("autonomy")} style={{ ...tabBtn, background: activeSection === "autonomy" ? "#2e1065" : "transparent", color: activeSection === "autonomy" ? "#e9d5ff" : "#94a3b8", borderColor: activeSection === "autonomy" ? "#a78bfa" : "#1e293b" }}>Autonomy · {autonomyData?.tier ?? "…"}</button>
            <button onClick={() => setActiveSection("lessons")} style={{ ...tabBtn, background: activeSection === "lessons" ? "#0f172a" : "transparent", color: activeSection === "lessons" ? "#e2e8f0" : "#94a3b8", borderColor: activeSection === "lessons" ? "#38bdf8" : "#1e293b" }}>Lessons · {data?.lessons?.length ?? "…"}</button>
            <button onClick={() => setActiveSection("projects")} style={{ ...tabBtn, background: activeSection === "projects" ? "#0f172a" : "transparent", color: activeSection === "projects" ? "#e2e8f0" : "#94a3b8", borderColor: activeSection === "projects" ? "#38bdf8" : "#1e293b" }}>Projects · {data?.projects?.length ?? "…"}</button>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {activeSection === "lessons" && (data?.lessons ?? []).map(l => {
              const lastAttemptForL = data?.attempts.find(a => a.lesson_id === l.lesson_id);
              const verdictColour = lastAttemptForL?.auto_verdict ? VERDICT_COLOUR[lastAttemptForL.auto_verdict] : "#334155";
              return (
                <div key={l.lesson_id} onClick={() => { setActiveLessonId(l.lesson_id); setLastAttempt(null); setReviewForm(null); }}
                  style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #1e293b", background: activeLessonId === l.lesson_id ? "#0f172a" : "transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>{l.title}</span>
                    <span style={{ fontSize: 9, color: verdictColour, fontFamily: "monospace", textTransform: "uppercase" }}>{lastAttemptForL?.auto_verdict ?? "unseen"}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{l.lesson_kind} · {l.difficulty}</div>
                </div>
              );
            })}
            {activeSection === "projects" && (
              <>
                {/* Seen */}
                {(data?.projects ?? []).filter(p => !p.unseen_evaluation).length > 0 && (
                  <div style={{ padding: "6px 14px", fontSize: 10, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em", background: "#0c4a6e22", borderBottom: "1px solid #075985" }}>SEEN · training</div>
                )}
                {(data?.projects ?? []).filter(p => !p.unseen_evaluation).map(p => {
                  const last = data?.project_attempts?.find(a => a.project_id === p.project_id);
                  const verdictColour = last?.overall_verdict ? VERDICT_COLOUR[last.overall_verdict] : "#334155";
                  return (
                    <div key={p.project_id} onClick={() => { setActiveProjectId(p.project_id); setActiveLessonId(null); setLastProjectResult(null); }}
                         style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #1e293b", background: activeProjectId === p.project_id ? "#0f172a" : "transparent" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>{p.title}</span>
                        <span style={{ fontSize: 9, color: verdictColour, fontFamily: "monospace", textTransform: "uppercase" }}>{last?.overall_verdict ?? "unseen"}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{p.difficulty} · {p.milestones.length} milestone(s)</div>
                    </div>
                  );
                })}
                {/* Unseen · visually separated */}
                {(data?.projects ?? []).filter(p => p.unseen_evaluation).length > 0 && (
                  <div style={{ padding: "6px 14px", fontSize: 10, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.08em", background: "#450a0a22", borderTop: "1px solid #991b1b", borderBottom: "1px solid #991b1b" }}>UNSEEN · evaluation only</div>
                )}
                {(data?.projects ?? []).filter(p => p.unseen_evaluation).map(p => {
                  const last = data?.project_attempts?.find(a => a.project_id === p.project_id);
                  const verdictColour = last?.overall_verdict ? VERDICT_COLOUR[last.overall_verdict] : "#334155";
                  return (
                    <div key={p.project_id} onClick={() => { setActiveProjectId(p.project_id); setActiveLessonId(null); setLastProjectResult(null); }}
                         style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #1e293b", background: activeProjectId === p.project_id ? "#3f0a0a" : "#280606" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "#fecaca", fontWeight: 600 }}>{p.title}</span>
                        <span style={{ fontSize: 9, color: verdictColour, fontFamily: "monospace", textTransform: "uppercase" }}>{last?.overall_verdict ?? "unseen"}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#f87171", fontFamily: "monospace" }}>{p.difficulty} · {p.milestones.length} milestone(s) · UNSEEN</div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </aside>

        {/* Center: current lesson */}
        <main style={main}>
          {/* Autonomy Dashboard · founder's permanent metric layer */}
          {activeSection === "autonomy" && (
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1, overflow: "auto" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b" }}>
                <div style={{ fontSize: 11, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Autonomy Dashboard · permanent metric layer</div>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginTop: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>tier: <span style={{ color: autonomyData?.tier === "HIGH" ? "#4ade80" : autonomyData?.tier === "MEDIUM" ? "#facc15" : "#f87171" }}>{autonomyData?.tier ?? "…"}</span></span>
                  {autonomyData?.next_tier && autonomyData.next_tier !== autonomyData.tier && (
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>next tier: <b style={{ color: autonomyData.next_tier === "HIGH" ? "#4ade80" : "#facc15" }}>{autonomyData.next_tier}</b></span>
                  )}
                  <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginLeft: "auto" }}>{autonomyData?.computed_at ? new Date(autonomyData.computed_at).toLocaleTimeString() : ""}</span>
                </div>
                <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 8, lineHeight: 1.5 }}>
                  Founder&apos;s permanent measurement. Signals 1-5 measure capability from training. Signal 6 measures generalisation across 7 unseen families. Signals 7-9 measure real-world behaviour — these will eventually matter MORE than the training scores.
                </div>
              </div>
              <div style={{ padding: "12px 20px" }}>
                {(autonomyData?.signals ?? []).map(s => {
                  const barValue = s.higher_is_worse ? 100 - s.value : s.value;
                  const barColour = barValue >= 80 ? "#4ade80" : barValue >= 50 ? "#facc15" : "#f87171";
                  return (
                    <div key={s.key} style={{ marginBottom: 10, padding: "8px 10px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, color: "#e2e8f0", fontWeight: 600 }}>{s.label}</span>
                        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{s.category}</span>
                          <span style={{ fontSize: 11, color: barColour, fontFamily: "monospace", fontWeight: 700 }}>{s.value}%</span>
                        </span>
                      </div>
                      <div style={{ height: 6, background: "#0a0d10", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, s.value)}%`, background: barColour, transition: "width 0.6s" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, fontFamily: "monospace" }}>{s.raw}{s.higher_is_worse ? " · lower is better" : ""}</div>
                      {s.notes && <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2 }}>{s.notes}</div>}
                    </div>
                  );
                })}
                <div style={{ marginTop: 20, padding: "12px 14px", background: "#0f1418", border: "1px solid #1e293b", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Unseen family coverage · need ≥1 pass in each for HIGH tier</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
                    {(autonomyData?.unseen_family_coverage ?? []).map(f => (
                      <div key={f.family} style={{ padding: "6px 8px", background: f.passed > 0 ? "#052e16" : "#1e1b2e", border: "1px solid " + (f.passed > 0 ? "#166534" : "#312e81"), borderRadius: 4, fontSize: 11, fontFamily: "monospace" }}>
                        <span style={{ color: f.passed > 0 ? "#4ade80" : "#94a3b8" }}>{f.passed > 0 ? "✓" : "·"} {f.family}</span>
                        <span style={{ float: "right", color: "#64748b" }}>{f.passed}/{f.total_available}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {(autonomyData?.next_tier_gap?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 14, padding: "10px 14px", background: "#1e1b2e", border: "1px solid #4c1d95", borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Gap to next tier</div>
                    {(autonomyData?.next_tier_gap ?? []).map((g, i) => <div key={i} style={{ fontSize: 11.5, color: "#cbd5e1", marginBottom: 3 }}>· {g}</div>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Projects panel · shown when a project is active */}
          {activeSection === "projects" && activeProjectId && (() => {
            const project = data?.projects?.find(p => p.project_id === activeProjectId);
            if (!project) return null;
            return (
              <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", background: project.unseen_evaluation ? "#450a0a11" : undefined }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{project.project_key} · {project.difficulty}</span>
                    {project.unseen_evaluation && <span style={{ fontSize: 9, color: "#fecaca", fontFamily: "monospace", padding: "2px 6px", background: "#450a0a", border: "1px solid #991b1b", borderRadius: 3, fontWeight: 700 }}>UNSEEN · EVALUATION ONLY</span>}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: project.unseen_evaluation ? "#fecaca" : "#e2e8f0" }}>{project.title}</div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>{project.description}</div>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button onClick={attemptProjectRun} disabled={projectRunning} style={{ ...primaryBtn, background: project.unseen_evaluation ? "#7c2d12" : "#0c4a6e", borderColor: project.unseen_evaluation ? "#f87171" : "#38bdf8", opacity: projectRunning ? 0.5 : 1 }}>
                      {projectRunning ? "nex1 attempting…" : (project.unseen_evaluation ? "nex1 attempts (UNSEEN eval) →" : "nex1 attempts →")}
                    </button>
                    <span style={{ fontSize: 11, color: "#64748b" }}>touches: {project.competency_domains.join(" · ")}</span>
                  </div>
                </div>
                <div style={{ overflowY: "auto", flex: 1, padding: "12px 20px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Milestones · {project.milestones.length}</div>
                  {project.milestones.map((m, i) => (
                    <div key={m.id} style={{ padding: "6px 10px", background: "#0a0d10", border: "1px solid #131a24", borderRadius: 4, marginBottom: 4, fontSize: 11, color: "#cbd5e1", fontFamily: "monospace" }}>
                      {i + 1}. <b>{m.name}</b> <span style={{ color: "#64748b" }}>({m.kind})</span>
                    </div>
                  ))}
                  {lastProjectResult && (
                    <div style={{ marginTop: 18, padding: 14, background: "#0f1418", border: "1px solid " + (VERDICT_COLOUR[lastProjectResult.result.overall_verdict] ?? "#1e293b"), borderRadius: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>attempt {lastProjectResult.attempt_id.slice(0, 8)} · {project.unseen_evaluation ? "UNSEEN" : "seen"}</span>
                        <span style={{ fontSize: 12, color: VERDICT_COLOUR[lastProjectResult.result.overall_verdict] ?? "#94a3b8", fontFamily: "monospace", fontWeight: 700 }}>
                          {lastProjectResult.result.overall_verdict.toUpperCase()} · overall {lastProjectResult.result.overall_score.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Per-milestone breakdown</div>
                      {lastProjectResult.result.milestone_results.map((mr, i) => (
                        <div key={i} style={{ fontFamily: "monospace", fontSize: 11, color: "#cbd5e1", padding: "3px 0", borderBottom: "1px dotted #1e293b" }}>
                          m{i + 1} {mr.name} · <span style={{ color: VERDICT_COLOUR[mr.auto.verdict] ?? "#94a3b8" }}>{mr.auto.verdict}</span> · score {mr.auto.score.toFixed(2)}
                        </div>
                      ))}
                      {lastProjectResult.competency_bumps.length > 0 && (
                        <>
                          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 10, marginBottom: 4 }}>Competency bumps</div>
                          {lastProjectResult.competency_bumps.map((b, i) => (
                            <div key={i} style={{ fontSize: 11, color: "#4ade80", fontFamily: "monospace" }}>+{b.delta} → {b.domain} · {b.reason}</div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {activeSection === "lessons" && !active && (
            <div style={helperCard}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>What is this room?</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                Nex1 is a junior engineer learning the NEX way of coding. Pick a lesson on the left and press <b>nex1 attempts</b>.
                Nex1 uses its regular tool surface (read_file · search_code · architecture_scan) to answer. A deterministic scorer marks the attempt
                against the passing criteria. If you agree, press <b>Promote</b> to add the learning to <code style={{ color: "#94a3b8" }}>nex_agent.doctrine_entries</code> and eventually <code style={{ color: "#94a3b8" }}>rules/NEX-CODING-DOCTRINE.md</code>.
                <br /><br />
                <b>Between every phase</b>: one training session lands new doctrine before nex1 gains new powers (V1.2 self-repair · V1.3 database engineer · etc.).
              </div>
            </div>
          )}
          {activeSection === "lessons" && active && (
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", marginBottom: 4 }}>{active.lesson_key} · {active.lesson_kind} · {active.difficulty}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{active.title}</div>
                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>{active.description}</div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button onClick={attempt} disabled={running} style={{ ...primaryBtn, opacity: running ? 0.5 : 1 }}>{running ? "nex1 thinking…" : "nex1 attempts →"}</button>
                </div>
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: "12px 20px" }}>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Material shown to nex1</div>
                <pre style={preBox}>{JSON.stringify(active.material, null, 2)}</pre>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 14, marginBottom: 6 }}>Passing criteria</div>
                <pre style={preBox}>{JSON.stringify(active.passing_criteria, null, 2)}</pre>

                {lastAttempt && (
                  <div style={{ marginTop: 18, padding: 14, background: "#0f1418", border: "1px solid " + (VERDICT_COLOUR[lastAttempt.auto.verdict] ?? "#1e293b"), borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>attempt {lastAttempt.attempt_id.slice(0, 8)}</span>
                      <span style={{ fontSize: 12, color: VERDICT_COLOUR[lastAttempt.auto.verdict] ?? "#94a3b8", fontFamily: "monospace", fontWeight: 700 }}>
                        {lastAttempt.auto.verdict.toUpperCase()} · score {lastAttempt.auto.score.toFixed(2)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Nex1&apos;s submitted answer</div>
                    <pre style={preBox}>{JSON.stringify(lastAttempt.submitted_answer, null, 2)}</pre>
                    {lastAttempt.auto.findings.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 10, marginBottom: 4 }}>Auto scorer findings</div>
                        <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                          {lastAttempt.auto.findings.map((f, i) => (
                            <div key={i} style={{ marginBottom: 3 }}>
                              <span style={{ color: f.severity === "error" ? "#f87171" : f.severity === "warning" ? "#facc15" : "#94a3b8", fontFamily: "monospace" }}>[{f.severity}]</span>
                              {" "}<span style={{ fontFamily: "monospace", color: "#94a3b8" }}>{f.rule}</span> · {f.detail}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => review(lastAttempt.attempt_id, "pass", "mentor confirms · nex1 answered correctly")} style={smallBtn}>Mentor · confirm PASS</button>
                      <button onClick={() => review(lastAttempt.attempt_id, "needs_revision", "mentor asks nex1 to try again")} style={{ ...smallBtn, background: "#422006", borderColor: "#eab308", color: "#facc15" }}>Mentor · needs revision</button>
                      <button onClick={() => setReviewForm({ verdict: "pass", notes: "", doctrine_key: `D-${(data?.doctrine.length ?? 0) + 1}`.padEnd(6, "0"), doctrine_text: "", severity: "guidance" })} style={{ ...smallBtn, background: "#0c4a6e", borderColor: "#38bdf8", color: "#7dd3fc" }}>Promote → doctrine</button>
                    </div>
                  </div>
                )}

                {reviewForm && (
                  <div style={{ marginTop: 14, padding: 14, background: "#0f1418", border: "1px solid #38bdf8", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#7dd3fc", marginBottom: 8 }}>Promote learning to permanent doctrine</div>
                    <label style={labelStyle}>doctrine_key</label>
                    <input value={reviewForm.doctrine_key} onChange={e => setReviewForm({ ...reviewForm, doctrine_key: e.target.value })} style={inputStyle} placeholder="D-009" />
                    <label style={labelStyle}>doctrine_text (one paragraph · the rule nex1/2/3 will follow forever)</label>
                    <textarea value={reviewForm.doctrine_text} onChange={e => setReviewForm({ ...reviewForm, doctrine_text: e.target.value })} style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }} placeholder="e.g. 'Every new route handler MUST use runtime=nodejs and export dynamic = force-dynamic when reading Postgres.'" />
                    <label style={labelStyle}>severity</label>
                    <select value={reviewForm.severity} onChange={e => setReviewForm({ ...reviewForm, severity: e.target.value })} style={inputStyle}>
                      <option value="guidance">guidance</option>
                      <option value="mandatory">mandatory</option>
                      <option value="forbidden">forbidden</option>
                    </select>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={promote} disabled={!reviewForm.doctrine_text.trim()} style={{ ...primaryBtn, opacity: reviewForm.doctrine_text.trim() ? 1 : 0.5 }}>Promote</button>
                      <button onClick={() => setReviewForm(null)} style={smallBtn}>Cancel</button>
                    </div>
                  </div>
                )}

                {attemptsForActive.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Previous attempts on this lesson · {attemptsForActive.length}</div>
                    {attemptsForActive.map(a => (
                      <div key={a.attempt_id} style={{ padding: "6px 10px", background: "#0a0d10", border: "1px solid #131a24", borderRadius: 4, marginBottom: 6, fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                        {new Date(a.attempted_at).toLocaleString().slice(0, 16)} · <span style={{ color: VERDICT_COLOUR[a.auto_verdict ?? "fail"] ?? "#94a3b8" }}>{a.auto_verdict}</span> · score {a.auto_score?.toFixed(2) ?? "-"}
                        {a.mentor_verdict && <span> · mentor: <span style={{ color: VERDICT_COLOUR[a.mentor_verdict] ?? "#94a3b8" }}>{a.mentor_verdict}</span></span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Right: competency ledger + doctrine ledger stacked */}
        <aside style={aside}>
          {/* Autonomy tier + Competency ledger · top */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #1e293b" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Nex1 competency</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "#64748b" }}>autonomy tier</span>
              {data?.autonomy?.tier && (
                <span style={{ fontFamily: "monospace", fontSize: 12, padding: "3px 8px", borderRadius: 3, background: (TIER_COLOUR[data.autonomy.tier] ?? "#334155") + "22", color: TIER_COLOUR[data.autonomy.tier] ?? "#94a3b8", border: "1px solid " + (TIER_COLOUR[data.autonomy.tier] ?? "#334155"), fontWeight: 700 }}>{data.autonomy.tier}</span>
              )}
              {data?.autonomy?.next_tier && (
                <span style={{ fontSize: 10, color: "#64748b" }}>· next: <span style={{ color: TIER_COLOUR[data.autonomy.next_tier] ?? "#94a3b8" }}>{data.autonomy.next_tier}</span></span>
              )}
            </div>
          </div>
          <div style={{ overflowY: "auto", maxHeight: 340, borderBottom: "1px solid #1e293b" }}>
            {(data?.competencies ?? []).length === 0 && <div style={{ padding: 14, fontSize: 11, color: "#64748b" }}>no competencies seeded</div>}
            {(data?.competencies ?? []).map(c => {
              const pct = Math.min(100, Math.round((Number(c.achieved_score) / (c.target_score || 1)) * 100));
              const barColour = pct >= 100 ? "#4ade80" : pct >= 80 ? "#facc15" : pct > 0 ? "#38bdf8" : "#475569";
              return (
                <div key={c.competency_id} style={{ padding: "8px 14px", borderBottom: "1px solid #131a24" }} title={c.description ?? undefined}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, color: "#e2e8f0" }}>{c.domain_label}</span>
                    <span style={{ fontSize: 10, color: TIER_COLOUR[c.required_for_tier] ?? "#94a3b8", fontFamily: "monospace" }}>{c.required_for_tier}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "#0a0d10", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: barColour, transition: "width 0.4s" }} />
                    </div>
                    <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", minWidth: 40, textAlign: "right" }}>{Number(c.achieved_score).toFixed(0)}/{c.target_score}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Doctrine ledger · bottom */}
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #1e293b" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Doctrine ledger</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>{data?.doctrine?.length ?? "…"} promoted lessons</div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {(data?.doctrine ?? []).length === 0 && <div style={{ padding: 14, fontSize: 11, color: "#64748b" }}>no doctrine promoted yet</div>}
            {(data?.doctrine ?? []).map(d => (
              <div key={d.doctrine_id} style={{ padding: "10px 14px", borderBottom: "1px solid #1e293b" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#e2e8f0", fontWeight: 700 }}>{d.doctrine_key}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 9.5, color: SEVERITY_COLOUR[d.severity] ?? "#94a3b8", textTransform: "uppercase" }}>{d.severity}</span>
                </div>
                <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.4 }}>{d.doctrine_text}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid #1e293b", fontSize: 10, color: "#64748b" }}>
            <code>rules/NEX-CODING-DOCTRINE.md</code> · <code>rules/architecture.json</code>
          </div>
        </aside>
      </div>

      {err && <div style={{ position: "fixed", bottom: 20, right: 20, background: "#450a0a", color: "#f87171", padding: "8px 14px", fontSize: 12, borderRadius: 4, border: "1px solid #991b1b" }}>err · {err}</div>}
    </div>
  );
}

// ─── styles ─────────────────────────────────────────────────────
const page: React.CSSProperties = { height: "100vh", display: "flex", flexDirection: "column", background: "#0a0d10", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
const header: React.CSSProperties = { padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e293b", background: "#080b0d", flexShrink: 0 };
const navLink: React.CSSProperties = { padding: "5px 10px", borderRadius: 4, background: "#0f172a", color: "#94a3b8", textDecoration: "none", fontSize: 11, border: "1px solid #1e293b" };
const body: React.CSSProperties = { display: "flex", flex: 1, minHeight: 0 };
const aside: React.CSSProperties = { width: 320, borderLeft: "1px solid #1e293b", display: "flex", flexDirection: "column", flexShrink: 0, background: "#080b0d" };
const main: React.CSSProperties = { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 };
const helperCard: React.CSSProperties = { margin: 20, padding: 20, background: "#0f1418", border: "1px solid #1e293b", borderRadius: 10 };
const preBox: React.CSSProperties = { background: "#0a0d10", border: "1px solid #131a24", padding: 10, borderRadius: 4, fontSize: 11, color: "#cbd5e1", fontFamily: "'SF Mono', Monaco, Consolas, monospace", overflow: "auto", maxHeight: 260, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" };
const primaryBtn: React.CSSProperties = { background: "#0c4a6e", color: "#fff", padding: "8px 14px", fontSize: 12, borderRadius: 4, border: "1px solid #38bdf8", cursor: "pointer", fontWeight: 700 };
const smallBtn: React.CSSProperties = { background: "#052e16", color: "#4ade80", padding: "6px 10px", fontSize: 11, borderRadius: 4, border: "1px solid #166534", cursor: "pointer" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 10, color: "#94a3b8", marginTop: 8, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 10px", background: "#0a0d10", border: "1px solid #1e293b", color: "#e2e8f0", borderRadius: 4, fontSize: 12, fontFamily: "'SF Mono', Monaco, Consolas, monospace" };
const tabBtn: React.CSSProperties = { flex: 1, padding: "6px 8px", fontSize: 11, borderRadius: 4, border: "1px solid", cursor: "pointer", fontFamily: "inherit" };
