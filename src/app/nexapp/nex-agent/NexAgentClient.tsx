"use client";

// src/app/nexapp/nex-agent/NexAgentClient.tsx
//
// NEX Agent v1.1 · founder-facing single-page interface.
// - Main workspace (left) shows nex1/nex2/nex3 reasoning stream · round labels · proposed diffs
// - Side panel (right) lists recent tasks · click to reopen · + new
// - Prompt bar pinned to bottom
// - LIVE STREAM via EventSource (SSE) · polls task index every 5s

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Task {
  task_id: string; submitted_at: string; updated_at: string; submitted_by: string;
  prompt: string; status: string; current_actor: string | null;
  plan?: PlanShape | null; brief?: string | null;
}
interface ProposedFile { path: string; action: "create" | "modify"; language: string; why: string; preview_content: string; }
interface PlanShape {
  intent?: { kind: string; confidence: number };
  files_to_create?: string[];
  files_to_touch?: string[];
  acceptance_test?: string;
  steps?: Array<{ number: number; action: string; rationale: string; tool?: string; target?: string }>;
  risks?: string[];
  verification_gates_to_run?: string[];
  proposed_files?: ProposedFile[];
  round?: number;
}
interface Step {
  step_id: string; task_id: string; created_at: string;
  actor: "nex1" | "nex2" | "nex3" | "founder" | "system";
  step_kind: string; title: string; body: unknown;
}

const ACTOR_COLOUR: Record<Step["actor"], string> = {
  nex1: "#38bdf8", nex2: "#a78bfa", nex3: "#4ade80", founder: "#facc15", system: "#94a3b8",
};
const STATUS_COLOUR: Record<string, string> = {
  submitted: "#94a3b8", clarifying: "#facc15", planning: "#38bdf8",
  plan_ready: "#4ade80", plan_rejected: "#f87171", plan_approved: "#22d3ee",
  applying: "#7dd3fc", applied_verified: "#22c55e", applied_needs_review: "#facc15",
  migration_applied: "#22c55e", migration_failed: "#f87171",
  shipped: "#22c55e", archived: "#64748b",
};

interface StepBody { round?: number; gate?: string; ok?: boolean; error_count?: number; warning_count?: number; summary?: { passed?: number; failed?: number; skipped?: number; total?: number }; failed_files?: Array<{ file?: string; message: string }>; findings?: Array<{ severity: string; rule?: string; detail?: string; message?: string; location?: string; file?: string; line?: number }>; changes_applied?: string[]; cannot_revise?: string[]; proposed_files?: Array<{ path: string; action: string; language: string; why: string }>; timed_out?: boolean; stderr_tail?: string; results?: Array<{ gate: string; ok: boolean; duration_ms: number; error_count?: number; warning_count?: number }>; all_pass?: boolean; [k: string]: unknown; }
function stepRound(s: Step): number | undefined { const b = s.body as StepBody | null; return b?.round; }

export function NexAgentClient() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [briefModal, setBriefModal] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<"idle" | "live" | "closed" | "error">("idle");
  const [autonomyTier, setAutonomyTier] = useState<"LOW" | "MEDIUM" | "HIGH" | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      const r = await fetch("/api/nex/agent/stream", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setTasks(j.tasks);
    } catch { /* transient · ignore */ }
  }, []);

  useEffect(() => { void loadTasks(); const iv = setInterval(loadTasks, 5000); return () => clearInterval(iv); }, [loadTasks]);

  // Poll competency ledger for the current autonomy tier · surface it in the header
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const fetchTier = async () => {
      try {
        const r = await fetch("/api/nex/agent/training", { cache: "no-store", signal: ac.signal });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled && j.ok && j.autonomy?.tier) setAutonomyTier(j.autonomy.tier);
      } catch { /* transient · ignore */ }
    };
    void fetchTier();
    const iv = setInterval(fetchTier, 20000);
    return () => { cancelled = true; ac.abort(); clearInterval(iv); };
  }, []);

  // Open SSE for the active task · close on switch or unmount
  useEffect(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    if (!activeId) { setActiveTask(null); setSteps([]); setStreamState("idle"); return; }
    setSteps([]);
    setStreamState("live");
    const es = new EventSource(`/api/nex/agent/stream?task_id=${activeId}&sse=1`);
    esRef.current = es;
    es.addEventListener("task", (ev) => { try { setActiveTask(JSON.parse((ev as MessageEvent).data)); } catch { /* skip */ } });
    es.addEventListener("step", (ev) => {
      try {
        const s = JSON.parse((ev as MessageEvent).data) as Step;
        setSteps(prev => prev.some(x => x.step_id === s.step_id) ? prev : [...prev, s]);
      } catch { /* skip */ }
    });
    es.addEventListener("ping", () => { /* keep-alive · ignore */ });
    es.addEventListener("close", () => { setStreamState("closed"); es.close(); });
    es.onerror = () => { setStreamState("error"); };
    return () => { es.close(); esRef.current = null; };
  }, [activeId]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [steps]);

  async function submit() {
    if (!prompt.trim() || submitting) return;
    setSubmitting(true); setErr(null);
    try {
      const body: Record<string, unknown> = { prompt };
      if (activeTask?.status === "clarifying") body.continue_task_id = activeTask.task_id;
      const r = await fetch("/api/nex/agent/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.ok) { setActiveId(j.task_id); setPrompt(""); void loadTasks(); }
      else setErr(j.error || "submit failed");
    } catch (e) { setErr(e instanceof Error ? e.message : "err"); }
    finally { setSubmitting(false); }
  }
  async function approve() {
    if (!activeTask || activeTask.status !== "plan_ready") return;
    try {
      const r = await fetch("/api/nex/agent/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task_id: activeTask.task_id }) });
      const j = await r.json();
      if (j.ok && j.brief) { setBriefModal(j.brief); setCopied(false); void loadTasks(); }
      else setErr(j.error || "approve failed");
    } catch (e) { setErr(e instanceof Error ? e.message : "err"); }
  }
  const [verifying, setVerifying] = useState<null | { gates: string[]; started_at: string }>(null);
  async function runVerification(gates: string[] = ["typecheck", "lint", "tests"]) {
    if (!activeTask || verifying) return;
    setVerifying({ gates, started_at: new Date().toISOString() });
    setErr(null);
    try {
      const r = await fetch("/api/nex/agent/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task_id: activeTask.task_id, gates }) });
      const j = await r.json();
      if (!j.ok) setErr(j.error || "verify failed");
    } catch (e) { setErr(e instanceof Error ? e.message : "err"); }
    finally { setVerifying(null); }
  }
  // V1.3 · Database Engineer panel state
  const [migrationSql, setMigrationSql] = useState<string>("");
  const [dryRunResult, setDryRunResult] = useState<{ ok: boolean; statements_executed: number; destructive: unknown[]; first_error?: string; results: Array<{ ordinal: number; status: string; sql_snippet: string; error?: string; rowCount?: number | null }> } | null>(null);
  const [applyPhrase, setApplyPhrase] = useState<string>("");
  const [allowDestructive, setAllowDestructive] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [applyingMigration, setApplyingMigration] = useState(false);
  // When the active task's plan has a SQL proposed_file, prefill the migration SQL
  useEffect(() => {
    const sqlFile = activeTask?.plan?.proposed_files?.find(pf => pf.language === "sql");
    if (sqlFile && migrationSql === "") setMigrationSql(sqlFile.preview_content);
  }, [activeTask?.task_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runDryRun() {
    if (!activeTask || !migrationSql.trim() || dryRunning) return;
    setDryRunning(true); setErr(null); setDryRunResult(null);
    try {
      const r = await fetch("/api/nex/agent/migration/dry-run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task_id: activeTask.task_id, sql: migrationSql }) });
      const j = await r.json();
      if (j.ok !== undefined) setDryRunResult({ ok: j.ok, statements_executed: j.data?.statements_executed ?? 0, destructive: j.data?.destructive_ops_detected ?? [], first_error: j.data?.first_error, results: j.data?.statement_results ?? [] });
      else setErr(j.error || "dry_run failed");
    } catch (e) { setErr(e instanceof Error ? e.message : "err"); }
    finally { setDryRunning(false); }
  }
  async function runApplyMigration() {
    if (!activeTask || applyingMigration) return;
    const requiredPhrase = (dryRunResult?.destructive.length ?? 0) > 0 ? "APPLY DESTRUCTIVE MIGRATION" : "APPLY MIGRATION";
    if (applyPhrase !== requiredPhrase) { setErr(`type '${requiredPhrase}' in the confirmation field first`); return; }
    if (!confirm(`Apply migration to nex_dev? · ${dryRunResult?.statements_executed ?? "?"} statement(s) · destructive: ${dryRunResult?.destructive.length ?? 0}`)) return;
    setApplyingMigration(true); setErr(null);
    try {
      const r = await fetch("/api/nex/agent/migration/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task_id: activeTask.task_id, sql: migrationSql, confirm_phrase: applyPhrase, applied_by: "founder", allow_destructive: allowDestructive }) });
      const j = await r.json();
      if (!j.ok) setErr(j.error || j.reason || "apply failed");
      else { setApplyPhrase(""); setDryRunResult(null); }
    } catch (e) { setErr(e instanceof Error ? e.message : "err"); }
    finally { setApplyingMigration(false); }
  }
  const isMigrationTask = activeTask?.plan?.intent?.kind === "add_migration" || (activeTask?.plan?.proposed_files ?? []).some(p => p.language === "sql");

  const [applying, setApplying] = useState(false);
  async function applyToWorktree() {
    if (!activeTask || applying) return;
    if (!confirm("Apply nex1's proposed files to an isolated worktree + run self-repair (up to 5 attempts)?\n\nNothing touches main. Founder inspects the worktree branch afterward.")) return;
    setApplying(true); setErr(null);
    try {
      const r = await fetch("/api/nex/agent/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task_id: activeTask.task_id }) });
      const j = await r.json();
      if (!j.ok) setErr(j.error || "apply failed");
    } catch (e) { setErr(e instanceof Error ? e.message : "err"); }
    finally { setApplying(false); }
  }
  async function copyBrief() {
    if (!briefModal) return;
    try { await navigator.clipboard.writeText(briefModal); setCopied(true); setTimeout(() => setCopied(false), 3000); }
    catch { alert("clipboard unavailable"); }
  }

  // Group steps by round for compact rendering
  const stepsByRound = useMemo(() => {
    const groups: Array<{ round: number | null; steps: Step[] }> = [];
    for (const s of steps) {
      const r = stepRound(s) ?? null;
      const last = groups[groups.length - 1];
      if (!last || last.round !== r) groups.push({ round: r, steps: [s] });
      else last.steps.push(s);
    }
    return groups;
  }, [steps]);

  const proposedFiles = activeTask?.plan?.proposed_files ?? [];

  return (
    <div style={page}>
      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: streamState === "live" ? "#38bdf8" : streamState === "error" ? "#f87171" : "#475569", boxShadow: streamState === "live" ? "0 0 8px #38bdf888" : "none" }} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>NEX Agent · nex1 · nex2 · nex3</div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>V1.2 · self-repair · isolated worktree · SSE</div>
          {autonomyTier && (
            <span style={{ fontFamily: "monospace", fontSize: 10, padding: "2px 8px", borderRadius: 3, background: (autonomyTier === "HIGH" ? "#052e16" : autonomyTier === "MEDIUM" ? "#422006" : "#450a0a"), color: (autonomyTier === "HIGH" ? "#4ade80" : autonomyTier === "MEDIUM" ? "#facc15" : "#f87171"), border: "1px solid " + (autonomyTier === "HIGH" ? "#166534" : autonomyTier === "MEDIUM" ? "#a16207" : "#991b1b"), fontWeight: 700 }} title="Autonomy tier · derived from competency ledger">autonomy · {autonomyTier}</span>
          )}
          {streamState !== "idle" && <span style={{ fontSize: 10, color: streamState === "live" ? "#4ade80" : "#64748b", fontFamily: "monospace" }}>stream · {streamState}</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/nexapp/hq" style={navLink}>← HQ</Link>
          <Link href="/nexapp/lab" style={navLink}>Labs</Link>
          <Link href="/nexapp/lab#innovation" style={navLink}>💡 Creative</Link>
          <Link href="/nexapp/nex-agent/training" style={{ ...navLink, borderColor: "#38bdf8", color: "#7dd3fc" }}>🎓 Training</Link>
        </div>
      </header>

      <div style={body}>
        <main style={main}>
          {!activeTask && (
            <div style={helperCard}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>What is this page?</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                Type or paste a prompt in the box at the bottom. NEX Agent has three robots that debate in rounds:
                <ul style={{ margin: "8px 0 8px 20px", padding: 0 }}>
                  <li><b style={{ color: ACTOR_COLOUR.nex1 }}>nex1</b> is the coder. It reads the codebase and writes a plan.</li>
                  <li><b style={{ color: ACTOR_COLOUR.nex2 }}>nex2</b> is the architect. It critiques the plan against NEX&apos;s rules.</li>
                  <li><b style={{ color: ACTOR_COLOUR.nex3 }}>nex3</b> is the security + doctrine reviewer.</li>
                </ul>
                They debate for up to <b>5 rounds</b>. If both reviewers pass in the same round, you get a <b style={{ color: "#4ade80" }}>plan_ready</b> · press <b>Approve</b> to receive a paste-ready engineering brief for your builder.
                <br /><br />
                <b>V1.1 additions:</b> live stream (SSE) · round-by-round discussion history · proposed-file previews you can read before approving.
              </div>
            </div>
          )}
          {activeTask && (
            <>
              <div style={taskHeader}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontFamily: "monospace" }}>task {activeTask.task_id.slice(0, 8)} · submitted by {activeTask.submitted_by}</div>
                  <div style={{ fontSize: 14, color: "#e2e8f0", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{activeTask.prompt}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <span style={{ ...statusChip, background: (STATUS_COLOUR[activeTask.status] ?? "#334155") + "22", color: STATUS_COLOUR[activeTask.status] ?? "#94a3b8", border: "1px solid " + (STATUS_COLOUR[activeTask.status] ?? "#334155") }}>{activeTask.status}</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {activeTask.status === "plan_ready" && <button onClick={approve} style={approveBtn}>Approve · get brief →</button>}
                    {(activeTask.status === "plan_ready" || activeTask.status === "plan_approved" || activeTask.status === "applied_needs_review") && (
                      <button
                        onClick={applyToWorktree}
                        disabled={applying}
                        style={{ ...applyBtn, opacity: applying ? 0.6 : 1 }}
                        title="Create isolated worktree, write proposed files, run verification + self-repair (up to 5 attempts). Nothing touches main."
                      >{applying ? "Applying + repairing…" : "Apply to worktree + self-repair →"}</button>
                    )}
                    {activeTask.status === "plan_ready" && (
                      <button
                        onClick={() => runVerification(["typecheck", "lint", "tests"])}
                        disabled={verifying !== null}
                        style={{ ...verifyBtn, opacity: verifying ? 0.6 : 1 }}
                        title="Baseline: run typecheck + lint + tests against the current tree. Takes 1-3 minutes."
                      >{verifying ? `Verifying (${verifying.gates.length} gates)…` : "Verify current tree"}</button>
                    )}
                  </div>
                </div>
              </div>

              <div ref={scrollRef} style={streamContainer}>
                {stepsByRound.length === 0 && <div style={{ color: "#64748b", padding: 20 }}>waiting for nex1…</div>}
                {stepsByRound.map((group, idx) => (
                  <div key={idx}>
                    {group.round != null && (
                      <div style={roundBanner}>─── ROUND {group.round} ───</div>
                    )}
                    {group.steps.map((s) => <StepRow key={s.step_id} step={s} />)}
                  </div>
                ))}

                {/* V1.3 · Database Engineer panel · appears on migration tasks */}
                {isMigrationTask && (
                  <div style={{ padding: "14px 20px", borderTop: "1px solid #1e293b", background: "#0a0d10" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: "#38bdf8", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Database Engineer · V1.3</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>dry-run first · then type <b style={{ color: "#38bdf8" }}>{(dryRunResult?.destructive.length ?? 0) > 0 ? "APPLY DESTRUCTIVE MIGRATION" : "APPLY MIGRATION"}</b> to apply</div>
                    </div>
                    <textarea
                      value={migrationSql}
                      onChange={(e) => { setMigrationSql(e.target.value); setDryRunResult(null); setApplyPhrase(""); }}
                      style={{ width: "100%", minHeight: 200, background: "#080b0d", color: "#e2e8f0", border: "1px solid #1e293b", borderRadius: 4, padding: 10, fontSize: 11, fontFamily: "'SF Mono', Monaco, Consolas, monospace", resize: "vertical" }}
                      placeholder="-- paste or edit migration SQL here"
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      <button onClick={runDryRun} disabled={dryRunning || !migrationSql.trim()} style={{ ...verifyBtn, opacity: dryRunning ? 0.6 : 1 }}>
                        {dryRunning ? "Dry-running…" : "Dry-run in SAVEPOINT (rolls back)"}
                      </button>
                      {dryRunResult && dryRunResult.ok && (
                        <>
                          <input value={applyPhrase} onChange={(e) => setApplyPhrase(e.target.value)} placeholder={(dryRunResult.destructive.length > 0) ? "APPLY DESTRUCTIVE MIGRATION" : "APPLY MIGRATION"}
                                 style={{ background: "#0a0d10", border: "1px solid " + ((dryRunResult.destructive.length > 0) ? "#f87171" : "#38bdf8"), color: "#e2e8f0", padding: "6px 10px", fontSize: 11, borderRadius: 4, fontFamily: "'SF Mono', Monaco, Consolas, monospace", minWidth: 300 }} />
                          {dryRunResult.destructive.length > 0 && (
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#f87171" }}>
                              <input type="checkbox" checked={allowDestructive} onChange={(e) => setAllowDestructive(e.target.checked)} /> allow destructive
                            </label>
                          )}
                          <button onClick={runApplyMigration} disabled={applyingMigration || !applyPhrase.trim()}
                                  style={{ ...applyBtn, background: (dryRunResult.destructive.length > 0) ? "#7c2d12" : "#4c1d95", borderColor: (dryRunResult.destructive.length > 0) ? "#f87171" : "#a78bfa", opacity: applyingMigration ? 0.6 : 1 }}>
                            {applyingMigration ? "Applying…" : (dryRunResult.destructive.length > 0 ? "APPLY (destructive)" : "APPLY MIGRATION")}
                          </button>
                        </>
                      )}
                    </div>
                    {dryRunResult && (
                      <div style={{ marginTop: 10, fontSize: 11 }}>
                        <div style={{ color: dryRunResult.ok ? "#4ade80" : "#f87171", fontFamily: "monospace", fontWeight: 700 }}>
                          dry-run · {dryRunResult.ok ? "PASS" : "FAIL"} · {dryRunResult.statements_executed} statement(s) · {dryRunResult.destructive.length > 0 ? `⚠ ${dryRunResult.destructive.length} destructive op(s) detected` : "no destructive ops"}
                        </div>
                        {dryRunResult.first_error && <div style={{ color: "#f87171", marginTop: 4, fontFamily: "monospace" }}>{dryRunResult.first_error}</div>}
                        {dryRunResult.results.map((r, i) => (
                          <div key={i} style={{ fontFamily: "monospace", color: r.status === "ok" ? "#94a3b8" : "#f87171", marginTop: 3 }}>
                            {r.ordinal}. [{r.status}] {r.sql_snippet}{r.rowCount != null && ` · ${r.rowCount} rows`}{r.error && ` · ${r.error}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {proposedFiles.length > 0 && (
                  <div style={proposedContainer}>
                    <div style={{ fontSize: 12, color: "#38bdf8", fontFamily: "monospace", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Proposed files · preview before approving</div>
                    {proposedFiles.map((pf, i) => (
                      <div key={i} style={{ marginBottom: 10, border: "1px solid #1e293b", borderRadius: 6, overflow: "hidden" }}>
                        <button onClick={() => setPreviewOpen(previewOpen === i ? null : i)}
                          style={{ width: "100%", padding: "10px 12px", background: "#0f1418", color: "#e2e8f0", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <span>
                              <span style={{ color: pf.action === "create" ? "#4ade80" : "#facc15", fontFamily: "monospace", fontSize: 10, fontWeight: 700, marginRight: 6 }}>{pf.action.toUpperCase()}</span>
                              <span style={{ fontFamily: "monospace", fontSize: 12 }}>{pf.path}</span>
                              <span style={{ color: "#64748b", fontSize: 10, fontFamily: "monospace", marginLeft: 8 }}>{pf.language}</span>
                            </span>
                            <span style={{ color: "#64748b", fontSize: 10 }}>{previewOpen === i ? "▼" : "▶"}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{pf.why}</div>
                        </button>
                        {previewOpen === i && (
                          <pre style={{ margin: 0, padding: 12, fontSize: 11, color: "#cbd5e1", background: "#0a0d10", overflow: "auto", maxHeight: 400, fontFamily: "'SF Mono', Monaco, Consolas, monospace", borderTop: "1px solid #1e293b", whiteSpace: "pre" }}>{pf.preview_content}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        <aside style={aside}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #1e293b" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Recent tasks</div>
            <button onClick={() => { setActiveId(null); }} style={sideBtn}>+ new</button>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {tasks.length === 0 && <div style={{ color: "#64748b", padding: 14, fontSize: 12 }}>no tasks yet · type a prompt below</div>}
            {tasks.map((t) => (
              <div key={t.task_id} onClick={() => setActiveId(t.task_id)}
                style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #1e293b", background: activeId === t.task_id ? "#0f172a" : "transparent" }}>
                <div style={{ fontSize: 12, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{t.prompt.slice(0, 80) || "(empty)"}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ ...statusChipSm, background: (STATUS_COLOUR[t.status] ?? "#334155") + "22", color: STATUS_COLOUR[t.status] ?? "#94a3b8" }}>{t.status}</span>
                  <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>{new Date(t.submitted_at).toLocaleTimeString().slice(0, 5)}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid #1e293b", fontSize: 10, color: "#64748b" }}>
            V1.1 · Read + Plan + preview diffs.<br />rules/ + db/migrations/ + docs/DECISIONS/ protected.<br />Discussion loop up to 5 rounds.
          </div>
        </aside>
      </div>

      <div style={promptBar}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
          placeholder={activeTask?.status === "clarifying" ? "Reply to nex1's questions · Cmd/Ctrl+Enter to send" : "Ask NEX Agent · add · fix · explain · refactor · migrate · route. Cmd/Ctrl+Enter to send."}
          style={promptField} rows={3}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={submit} disabled={submitting || !prompt.trim()} style={{ ...submitBtn, opacity: submitting || !prompt.trim() ? 0.5 : 1 }}>
            {submitting ? "Thinking…" : activeTask?.status === "clarifying" ? "Send reply" : "Submit"}
          </button>
          {err && <span style={{ fontSize: 10, color: "#f87171" }}>{err.slice(0, 40)}</span>}
        </div>
      </div>

      {briefModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 }} onClick={() => setBriefModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#0f172a", border: "1px solid #38bdf8", borderRadius: 10, maxWidth: 960, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 14, borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#38bdf8" }}>ENGINEERING BRIEF · nex1 · nex2 · nex3 signed off</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Paste this to your engineer</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => void copyBrief()} style={{ background: copied ? "#166534" : "#0c4a6e", color: "#fff", padding: "8px 14px", fontSize: 13, borderRadius: 4, border: "1px solid " + (copied ? "#22c55e" : "#38bdf8"), cursor: "pointer", fontWeight: 600 }}>{copied ? "✓ Copied!" : "Copy to clipboard"}</button>
                <button onClick={() => setBriefModal(null)} style={{ background: "#1e293b", color: "#cbd5e1", padding: "8px 14px", fontSize: 13, borderRadius: 4, border: "1px solid #334155", cursor: "pointer" }}>Close</button>
              </div>
            </div>
            <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontFamily: "'SF Mono', Monaco, Consolas, monospace", fontSize: 12, color: "#e2e8f0", lineHeight: 1.55 }}>{briefModal}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepRow({ step }: { step: Step }) {
  const colour = ACTOR_COLOUR[step.actor];
  const kindLabel = step.step_kind.replace(/_/g, " ");
  const body = step.body as StepBody | null;
  const hasFindings = Array.isArray(body?.findings) && body.findings.length > 0;
  const hasRevisionSummary = Array.isArray(body?.changes_applied) || Array.isArray(body?.cannot_revise);
  const isGateResult = typeof body?.gate === "string";
  const isVerificationSummary = Array.isArray(body?.results) && typeof body?.all_pass === "boolean";
  return (
    <div style={{ padding: "10px 14px", borderBottom: "1px solid #131a24" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: colour, fontWeight: 700, fontFamily: "monospace", textTransform: "uppercase" }}>{step.actor}</span>
        <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>{kindLabel}</span>
        {isGateResult && (
          <span style={{ fontSize: 10, fontFamily: "monospace", padding: "1px 5px", borderRadius: 3, background: body?.ok ? "#052e16" : "#450a0a", color: body?.ok ? "#4ade80" : "#f87171", fontWeight: 700 }}>
            {body?.gate?.toUpperCase()} · {body?.ok ? "PASS" : "FAIL"}
          </span>
        )}
        <span style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", marginLeft: "auto" }}>{new Date(step.created_at).toLocaleTimeString()}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "#e2e8f0", lineHeight: 1.5 }}>{step.title}</div>

      {/* Verification summary rollup */}
      {isVerificationSummary && (
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(body?.results ?? []).map((r, i) => (
            <span key={i} style={{ fontSize: 11, fontFamily: "monospace", padding: "4px 10px", borderRadius: 4, background: r.ok ? "#052e16" : "#450a0a", color: r.ok ? "#4ade80" : "#f87171", border: "1px solid " + (r.ok ? "#166534" : "#991b1b") }}>
              {r.gate} {r.ok ? "✓" : "✗"} · {Math.round(r.duration_ms / 100) / 10}s
              {typeof r.error_count === "number" && r.error_count > 0 && ` · ${r.error_count} err`}
              {typeof r.warning_count === "number" && r.warning_count > 0 && ` · ${r.warning_count} warn`}
            </span>
          ))}
        </div>
      )}

      {/* Verification findings (typecheck/lint style) */}
      {hasFindings && !isVerificationSummary && (
        <div style={{ marginTop: 6, borderLeft: "2px solid " + colour + "88", paddingLeft: 10 }}>
          {(body?.findings ?? []).slice(0, 15).map((f, i) => (
            <div key={i} style={{ fontSize: 11, color: "#cbd5e1", marginTop: 3 }}>
              <span style={{ fontFamily: "monospace", fontSize: 9.5, color: f.severity === "block" || f.severity === "violation" || f.severity === "error" ? "#f87171" : f.severity === "warn" || f.severity === "warning" ? "#facc15" : "#94a3b8" }}>[{f.severity}]</span>
              {" "}{f.rule && <span style={{ fontFamily: "monospace", color: "#94a3b8" }}>{f.rule}</span>} {f.detail ?? f.message}
              {f.file && <span style={{ fontFamily: "monospace", color: "#64748b", fontSize: 10 }}> ({f.file}{f.line ? `:${f.line}` : ""})</span>}
              {f.location && !f.file && <span style={{ fontFamily: "monospace", color: "#64748b", fontSize: 10 }}> ({f.location})</span>}
            </div>
          ))}
          {(body?.findings?.length ?? 0) > 15 && (
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>… +{(body?.findings?.length ?? 0) - 15} more</div>
          )}
        </div>
      )}

      {/* Test-summary block */}
      {body?.summary && !hasFindings && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#cbd5e1", fontFamily: "monospace" }}>
          passed={(body.summary as { passed?: number }).passed ?? "?"} · failed={(body.summary as { failed?: number }).failed ?? "?"} · skipped={(body.summary as { skipped?: number }).skipped ?? 0} · total={(body.summary as { total?: number }).total ?? "?"}
        </div>
      )}

      {hasRevisionSummary && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#cbd5e1" }}>
          {(body?.changes_applied ?? []).map((c, i) => <div key={i}>✓ {c}</div>)}
          {(body?.cannot_revise ?? []).map((c, i) => <div key={i} style={{ color: "#f87171" }}>✗ {c}</div>)}
        </div>
      )}

      {body?.stderr_tail && (
        <details style={{ marginTop: 6 }}>
          <summary style={{ fontSize: 10, color: "#64748b", cursor: "pointer" }}>stderr tail</summary>
          <pre style={{ margin: "6px 0 0 0", fontSize: 10.5, color: "#94a3b8", background: "#0a0d10", padding: 8, borderRadius: 4, overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap" }}>{body.stderr_tail}</pre>
        </details>
      )}

      {body != null && step.step_kind !== "thought" && !hasFindings && !hasRevisionSummary && !isGateResult && !isVerificationSummary && (
        <details style={{ marginTop: 6 }}>
          <summary style={{ fontSize: 10, color: "#64748b", cursor: "pointer" }}>raw body</summary>
          <pre style={{ margin: "6px 0 0 0", fontSize: 10.5, color: "#94a3b8", background: "#0a0d10", padding: 8, borderRadius: 4, overflow: "auto", maxHeight: 200 }}>{JSON.stringify(body, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

// ─── styles ─────────────────────────────────────────────────────
const page: React.CSSProperties = { height: "100vh", display: "flex", flexDirection: "column", background: "#0a0d10", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
const header: React.CSSProperties = { padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e293b", background: "#080b0d", flexShrink: 0 };
const navLink: React.CSSProperties = { padding: "5px 10px", borderRadius: 4, background: "#0f172a", color: "#94a3b8", textDecoration: "none", fontSize: 11, border: "1px solid #1e293b" };
const body: React.CSSProperties = { display: "flex", flex: 1, minHeight: 0 };
const main: React.CSSProperties = { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 };
const aside: React.CSSProperties = { width: 300, borderLeft: "1px solid #1e293b", display: "flex", flexDirection: "column", flexShrink: 0, background: "#080b0d" };
const helperCard: React.CSSProperties = { margin: 20, padding: 20, background: "#0f1418", border: "1px solid #1e293b", borderRadius: 10 };
const taskHeader: React.CSSProperties = { padding: "14px 20px", borderBottom: "1px solid #1e293b", display: "flex", gap: 14, alignItems: "flex-start" };
const streamContainer: React.CSSProperties = { flex: 1, overflowY: "auto" };
const roundBanner: React.CSSProperties = { padding: "8px 14px", fontSize: 11, fontFamily: "monospace", color: "#7dd3fc", background: "#0c4a6e22", borderTop: "1px solid #075985", borderBottom: "1px solid #075985", letterSpacing: "0.15em", textAlign: "center" };
const proposedContainer: React.CSSProperties = { padding: "14px 14px 20px", borderTop: "1px solid #1e293b", background: "#080b0d" };
const statusChip: React.CSSProperties = { fontSize: 10, fontFamily: "monospace", padding: "3px 8px", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" };
const statusChipSm: React.CSSProperties = { fontSize: 9, fontFamily: "monospace", padding: "1px 5px", borderRadius: 3, textTransform: "uppercase" };
const sideBtn: React.CSSProperties = { fontSize: 11, padding: "4px 8px", background: "#0f172a", color: "#cbd5e1", border: "1px solid #334155", borderRadius: 4, cursor: "pointer" };
const approveBtn: React.CSSProperties = { background: "#166534", color: "#fff", padding: "8px 14px", fontSize: 12, borderRadius: 4, border: "1px solid #22c55e", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" };
const verifyBtn: React.CSSProperties = { background: "#0c4a6e", color: "#fff", padding: "8px 12px", fontSize: 11, borderRadius: 4, border: "1px solid #38bdf8", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" };
const applyBtn: React.CSSProperties = { background: "#4c1d95", color: "#fff", padding: "8px 12px", fontSize: 11, borderRadius: 4, border: "1px solid #a78bfa", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" };
const promptBar: React.CSSProperties = { padding: "12px 20px", borderTop: "1px solid #1e293b", background: "#080b0d", display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0 };
const promptField: React.CSSProperties = { flex: 1, background: "#0f1418", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0", padding: "10px 12px", fontFamily: "inherit", fontSize: 13, resize: "vertical", minHeight: 60 };
const submitBtn: React.CSSProperties = { background: "#0c4a6e", color: "#fff", padding: "10px 18px", fontSize: 13, borderRadius: 6, border: "1px solid #38bdf8", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" };
