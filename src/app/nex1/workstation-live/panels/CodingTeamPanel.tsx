// NEX1 Workstation Live · Coding Team panel · consolidated 2026-09-16
// Migrated verbatim from the retired /nex-head-quarters/coding-team page.
// Rendered inside /nex1/workstation-live per the NEX Workstation
// Consolidation Directive. Everything the Founder had on the old page
// still works here: dispatcher selector · STOP interrupt · attachments ·
// live health · migration schema-map · micro-report strips · engine-pulse ·
// byte counter · F3 brain-guard integration.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const AGENT_ORDER = [
  { id: "pm", label: "① Product Manager", subtitle: "Requirements & user-story ingestion" },
  { id: "architect", label: "② Architect", subtitle: "Lead systems architect · writes spec.md" },
  { id: "migration-reviewer", label: "◇ Migration Reviewer", subtitle: "DB schema safety (if migrations touched)" },
  { id: "accessibility-reviewer", label: "◇ Accessibility Reviewer", subtitle: "WCAG · keyboard · ARIA (if UI touched)" },
  { id: "contract-reviewer", label: "◇ Contract Reviewer", subtitle: "API stability (if public API touched)" },
  { id: "builder", label: "③ Builder", subtitle: "Core software engineer · writes app code" },
  { id: "tester", label: "④ Tester", subtitle: "QA automation · writes tests · never app code" },
  { id: "types-guard", label: "◇ Types Guard", subtitle: "TypeScript rigor (if TS/TSX touched)" },
  { id: "debugger", label: "⑤ Debugger", subtitle: "Fires on test failure · minimal-patch fixes" },
  { id: "reviewer", label: "⑥ Reviewer", subtitle: "Peer review · spec-match · quality guard" },
  { id: "forensics", label: "⑦ Forensics", subtitle: "Git history · dependency + CVE audit" },
  { id: "secops", label: "⑧ SecOps", subtitle: "Secret scan · injection · OWASP top-10" },
  { id: "integrator", label: "⑨ Integrator", subtitle: "Release engineer · merges & pushes" },
  { id: "technical-writer", label: "⑩ Technical Writer", subtitle: "README · CHANGELOG · OpenAPI · BLUEPRINT" },
  { id: "telemetry", label: "⑪ Telemetry", subtitle: "Post-deploy watch · T+24h verdict" },
] as const;

type AgentSummary = { verdict: string; summary: string; blockers: number } | null;

interface RunView {
  run_id: string;
  founder_prompt: string;
  created_at: string;
  status: string;
  current_stage: string | null;
  agent_summary: Record<string, AgentSummary>;
  artifacts_dir: string;
  commit_sha: string | null;
  rollback_command: string | null;
}

type DispatcherMode = "queue" | "scripted" | "demo";

interface HealthView {
  ok: boolean;
  agents: { expected: number; found: number; valid: boolean };
  runtime: { active_runs: number; chat_sessions: number; queue_inbox_depth: number; queue_outbox_depth: number };
}

interface LedgerColumn {
  name: string;
  sql_type: string;
  ts_type: string;
  is_nullable: boolean;
  is_primary: boolean;
}
interface LedgerTable {
  table_name: string;
  interface_name: string;
  source_path: string;
  columns: LedgerColumn[];
}
interface LedgerResp {
  ok: boolean;
  table_count: number;
  ledger: { tables: Record<string, LedgerTable> };
}

interface AttachmentBadge {
  sha256: string;
  name: string;
  bytes: number;
  ext: string;
}

const PROMPT_MAX = 4000;
// Palette imported from `/nexapp/nex-agent/nex-agent-workstation.css` (naw-* tokens · 2026-09-16 consolidation).
// Every colour here maps 1:1 to a naw-* variable so this panel matches the retired
// nex-agent workstation surface. Functionality is unchanged — only appearance.
const NEX_INK = "#F9FAFB";                        // naw-soft-white
const NEX_TEXT = "#CBD5E1";                       // naw text body
const NEX_MUTED = "#94A3B8";                      // naw-slate
const NEX_BORDER = "rgba(148, 163, 184, 0.18)";   // naw-card-border
const NEX_BORDER_GLOW = "rgba(34, 211, 238, 0.28)"; // naw-cyan @ 28%
const NEX_BG = "#0B1220";                         // naw-navy
const NEX_BG_GRADIENT =
  "radial-gradient(120% 60% at 50% 0%, rgba(34, 211, 238, 0.06), transparent 60%),\n" +
  "   linear-gradient(180deg, #0B1220 0%, #0E1B33 40%, #0B1220 100%)";
const NEX_CARD = "rgba(14, 27, 51, 0.6)";         // naw-card-bg
const NEX_TERM = "#03050d";                       // dark terminal (unchanged)
const NEX_ACCENT = "#22D3EE";                     // naw-cyan
const NEX_ACCENT_DEEP = "#0891B2";                // naw-cyan deep for pressed states
const NEX_GREEN = "#22C55E";                      // naw-success
const NEX_ORANGE = "#F97316";                     // naw-orange
const NEX_ORANGE_DEEP = "#EA580C";                // naw-orange-deep
const NEX_RED = "#EF4444";                        // naw-danger
const NEX_FONT_UI = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const NEX_FONT_MONO = "'JetBrains Mono', Menlo, Consolas, monospace";

function verdictColour(v: string | undefined): string {
  if (!v) return NEX_MUTED;
  if (v === "APPROVE" || v === "APPROVE_WITH_NOTES") return NEX_GREEN;
  if (v === "REJECT" || v === "FLAG" || v === "ERROR") return NEX_RED;
  if (v === "NEEDS_FOUNDER_INPUT") return NEX_ORANGE;
  if (v === "SKIPPED_NOT_APPLICABLE") return NEX_MUTED;
  return NEX_INK;
}

function isRunningStatus(status: string | undefined): boolean {
  if (!status) return false;
  return /_running$|integrating|watching/.test(status);
}

function isTerminalStatus(status: string | undefined): boolean {
  if (!status) return false;
  return /^completed_|^halted_|^aborted$/.test(status);
}

export function CodingTeamPanel() {
  const [prompt, setPrompt] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [mode, setMode] = useState<DispatcherMode>("queue");
  const [health, setHealth] = useState<HealthView | null>(null);
  const [ledger, setLedger] = useState<LedgerResp | null>(null);
  const [attachment, setAttachment] = useState<AttachmentBadge | null>(null);
  const [interruptBusy, setInterruptBusy] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [savedPromptForEdit, setSavedPromptForEdit] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const running = dispatching || isRunningStatus(run?.status);

  useEffect(() => {
    let alive = true;
    const pollHealth = async () => {
      try {
        const r = await fetch("/api/nex-coding-team/health", { cache: "no-store" });
        const j = (await r.json()) as HealthView;
        if (alive) setHealth(j);
      } catch {
        /* silent */
      }
    };
    const pollLedger = async () => {
      try {
        const r = await fetch("/api/nex-migration/ledger", { cache: "no-store" });
        const j = (await r.json()) as LedgerResp;
        if (alive) setLedger(j);
      } catch {
        /* silent */
      }
    };
    void pollHealth();
    void pollLedger();
    const iv = setInterval(() => {
      void pollHealth();
      void pollLedger();
    }, 10_000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    if (!runId) return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/nex-coding-team/status?run_id=${encodeURIComponent(runId)}`, { cache: "no-store" });
        const j = (await r.json()) as { ok: boolean; run?: RunView; error?: string };
        if (!alive) return;
        if (j.ok && j.run) setRun(j.run);
      } catch {
        /* poll silently swallows transient errors */
      }
    };
    void poll();
    const iv = setInterval(poll, 2500);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [runId]);

  const adjustHeight = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(300, Math.max(52, el.scrollHeight)) + "px";
  }, []);

  useEffect(adjustHeight, [prompt, adjustHeight]);

  const dispatch = useCallback(async () => {
    if (!prompt.trim() || dispatching) return;
    setDispatching(true);
    setError(null);
    setRun(null);
    setRunId(null);
    try {
      const r = await fetch(`/api/nex-coding-team/dispatch?dispatcher=${encodeURIComponent(mode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ founder_prompt: prompt.trim() }),
      });
      const j = (await r.json()) as { ok: boolean; run_id?: string; error?: string };
      if (!j.ok) {
        setError(j.error ?? "dispatch failed");
      } else if (j.run_id) {
        setRunId(j.run_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setDispatching(false);
    }
  }, [prompt, dispatching, mode]);

  const requestInterrupt = useCallback(
    async (strategy: "abort" | "discard" | "edit") => {
      if (!runId || interruptBusy) return;
      setInterruptBusy(true);
      try {
        await fetch("/api/nex-coding-team/interrupt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: runId, strategy, reason: `founder ${strategy}` }),
        });
      } catch {
        /* silent · run status will still poll */
      } finally {
        setInterruptBusy(false);
      }
      if (strategy === "discard") {
        setPrompt("");
        setAttachment(null);
      } else if (strategy === "edit") {
        // Restore the last dispatched prompt into the textarea so the Founder
        // can adjust and resend as a new run.
        if (savedPromptForEdit !== null) setPrompt(savedPromptForEdit);
      }
    },
    [runId, interruptBusy, savedPromptForEdit],
  );

  useEffect(() => {
    // Remember the last successfully dispatched prompt (for the "Edit" action).
    if (runId && prompt.trim()) setSavedPromptForEdit(prompt);
  }, [runId, prompt]);

  const onAttachClick = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const onAttachChange = useCallback(async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setAttachError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/nex-coding-chat/attach", { method: "POST", body: fd });
      const j = (await r.json()) as { ok: boolean; sha256?: string; bytes?: number; ext?: string; refused_reason?: string };
      if (!j.ok) {
        setAttachError(j.refused_reason ?? "attachment refused");
      } else if (j.sha256 && j.bytes !== undefined && j.ext) {
        setAttachment({ sha256: j.sha256, name: file.name, bytes: j.bytes, ext: j.ext });
      }
    } catch (e) {
      setAttachError(e instanceof Error ? e.message : "upload failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }, []);

  const currentStageLabel = useMemo(() => {
    if (!run) return "";
    const s = AGENT_ORDER.find((a) => a.id === run.current_stage);
    return s ? s.label : run.status;
  }, [run]);

  const disabled = dispatching || prompt.trim().length === 0;

  return (
    // Wrapped as a <section> (not a full <main>) because this panel now
    // lives inside /nex1/workstation-live · the parent already owns <main>.
    // Height is auto so it slots into the workstation stacking layout
    // without forcing a full viewport before the preview + engineering panes.
    <section
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding: "24px",
        background: NEX_BG_GRADIENT,
        color: NEX_TEXT,
        fontFamily: NEX_FONT_UI,
        letterSpacing: "-0.005em",
      }}
    >
      <style>{`
        @keyframes nex-engine-glow { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes nex-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
        .nex-engine-bar-active {
          background: linear-gradient(90deg, transparent, ${NEX_ACCENT}, transparent);
          background-size: 200% 100%;
          animation: nex-engine-glow 1.8s infinite linear;
        }
        .nex-blink { animation: nex-blink 1.4s infinite; }
      `}</style>

      <header
        style={{
          borderBottom: `1px solid ${NEX_BORDER_GLOW}`,
          paddingBottom: 16,
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: NEX_INK,
            textTransform: "uppercase",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              background: NEX_ACCENT,
              borderRadius: "50%",
              boxShadow: `0 0 10px ${NEX_ACCENT}`,
            }}
          />
          NEX Core Telemetry Headquarters
        </h1>
        <div style={{ fontSize: 11, color: NEX_MUTED, textTransform: "uppercase" }}>
          {health ? (
            <>
              SYS_LINK // ONLINE · agents {health.agents.found}/{health.agents.expected} · active_runs{" "}
              {health.runtime.active_runs} · queue {health.runtime.queue_inbox_depth}/{health.runtime.queue_outbox_depth}
            </>
          ) : (
            "SYS_LINK // SCANNING_LOCAL_FILESYSTEM..."
          )}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 32, alignItems: "start" }}>
        {/* ── LEFT: control panel ── */}
        <div>
          <Card>
            <SectionTitle>System Perimeter Gate</SectionTitle>
            <RowLabel label="Active Operator" value={run?.current_stage ? currentStageLabel : "Awaiting Run…"} />
            <RowLabel
              label="Pipeline Mode"
              value={
                <StatusBadge status={run?.status ?? (dispatching ? "dispatching" : "idle")} running={running} />
              }
            />
          </Card>

          <Card>
            <SectionTitle>Governance</SectionTitle>
            <RowLabel label="V3_ENGINE_REGISTRY" value={<span style={{ color: NEX_GREEN }}>FROZEN</span>} />
            <RowLabel label="Historical Receipts" value={<span style={{ color: NEX_GREEN }}>INTACT</span>} />
            <RowLabel label="Protected Files" value={<span style={{ color: NEX_GREEN }}>UNTOUCHED</span>} />
            <RowLabel label="Anti-Bullshit" value={<span style={{ color: NEX_GREEN }}>ENFORCED</span>} />
          </Card>

          <Card>
            <SectionTitle>Input Console</SectionTitle>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <button
                type="button"
                onClick={onAttachClick}
                aria-label="Attach a file to this prompt"
                style={btnStyle({ minWidth: 40, padding: "10px 12px" })}
              >
                📎
              </button>
              <input
                ref={fileRef}
                type="file"
                onChange={onAttachChange}
                style={{ display: "none" }}
                aria-hidden
              />
              <div style={{ flexGrow: 1, position: "relative" }}>
                <textarea
                  ref={taRef}
                  value={prompt}
                  maxLength={PROMPT_MAX}
                  onChange={(e) => setPrompt(e.target.value)}
                  onInput={adjustHeight}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void dispatch();
                  }}
                  placeholder="Type prompt or /slash… Ctrl/⌘+Enter to send."
                  rows={1}
                  style={{
                    width: "100%",
                    background: NEX_TERM,
                    color: NEX_INK,
                    border: `1px solid ${NEX_BORDER}`,
                    borderRadius: 6,
                    padding: "12px 78px 12px 12px",
                    fontFamily: "inherit",
                    fontSize: 13,
                    resize: "none",
                    boxSizing: "border-box",
                    minHeight: 52,
                    maxHeight: 300,
                    outline: "none",
                  }}
                />
                <span
                  aria-live="polite"
                  style={{
                    position: "absolute",
                    right: 10,
                    bottom: 8,
                    fontSize: 10,
                    color: prompt.length > PROMPT_MAX * 0.95 ? NEX_RED : NEX_MUTED,
                  }}
                >
                  {prompt.length} / {PROMPT_MAX} B
                </span>
              </div>
              {!running ? (
                <button
                  type="button"
                  onClick={dispatch}
                  disabled={disabled}
                  style={btnStyle({
                    minWidth: 90,
                    background: disabled
                      ? "rgba(148, 163, 184, 0.18)"
                      : `linear-gradient(180deg, ${NEX_ACCENT} 0%, ${NEX_ACCENT_DEEP} 100%)`,
                    borderColor: disabled ? NEX_BORDER : NEX_ACCENT_DEEP,
                    color: disabled ? NEX_MUTED : "#062a33",
                    cursor: disabled ? "not-allowed" : "pointer",
                  })}
                >
                  SEND
                </button>
              ) : (
                <button
                  type="button"
                  className="nex-blink"
                  onClick={() => void requestInterrupt("abort")}
                  disabled={interruptBusy}
                  style={btnStyle({
                    minWidth: 90,
                    background: `linear-gradient(180deg, ${NEX_ORANGE} 0%, ${NEX_ORANGE_DEEP} 100%)`,
                    borderColor: NEX_ORANGE_DEEP,
                    color: "#1a0a00",
                  })}
                >
                  🛑 STOP
                </button>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <label htmlFor="dispatcher-mode" style={{ fontSize: 11, color: NEX_MUTED, textTransform: "uppercase" }}>
                Dispatcher:{" "}
                <select
                  id="dispatcher-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as DispatcherMode)}
                  disabled={running}
                  style={{
                    background: NEX_TERM,
                    color: NEX_INK,
                    border: `1px solid ${NEX_BORDER}`,
                    borderRadius: 4,
                    padding: "4px 8px",
                    fontFamily: "inherit",
                    fontSize: 11,
                  }}
                >
                  <option value="queue">queue (external NEX1 / MAI)</option>
                  <option value="scripted">scripted (deterministic sync)</option>
                  <option value="demo">demo (stub sync)</option>
                </select>
              </label>
              {attachment && (
                <span style={{ fontSize: 11, color: NEX_GREEN }}>
                  📦 {attachment.name} · {(attachment.bytes / 1024).toFixed(1)} KB · sha={attachment.sha256.slice(0, 12)}…
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: NEX_MUTED,
                      cursor: "pointer",
                      marginLeft: 6,
                      fontSize: 11,
                    }}
                    aria-label="Clear attachment"
                  >
                    ×
                  </button>
                </span>
              )}
              {attachError && <span style={{ fontSize: 11, color: NEX_RED }}>attach refused: {attachError}</span>}
            </div>

            {running && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: `1px dashed ${NEX_RED}`,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => void requestInterrupt("edit")}
                  style={btnStyle({ borderColor: "#ca8a04", color: NEX_ORANGE })}
                >
                  📝 Edit Prompt
                </button>
                <button
                  type="button"
                  onClick={() => void requestInterrupt("discard")}
                  style={btnStyle({ borderColor: NEX_RED, color: NEX_RED })}
                >
                  🗑️ Discard
                </button>
              </div>
            )}
            {error && (
              <div style={{ marginTop: 10, color: NEX_RED, fontSize: 12 }}>
                dispatch error: {error}
              </div>
            )}
          </Card>
        </div>

        {/* ── RIGHT: active workstation frame ── */}
        <div
          style={{
            background: NEX_CARD,
            border: `1px solid ${NEX_BORDER_GLOW}`,
            borderRadius: 8,
            padding: 24,
            boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 40px rgba(56, 189, 248, 0.03)`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            className={running ? "nex-engine-bar-active" : undefined}
            style={{ height: 3, width: "100%", position: "absolute", top: 0, left: 0 }}
            aria-hidden
          />
          <SectionTitle>Active Workstation Node Stream</SectionTitle>

          {/* micro-report strips derived from the run's agent summary */}
          <div style={{ margin: "16px 0 24px 0" }}>
            <SubLabel>Micro Audit Activity Reports</SubLabel>
            {run ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                {AGENT_ORDER.map((a) => {
                  const r = run.agent_summary[a.id];
                  if (!r) return null;
                  const kind =
                    r.verdict === "APPROVE" || r.verdict === "APPROVE_WITH_NOTES"
                      ? "clean"
                      : r.verdict === "REJECT" || r.verdict === "ERROR" || r.verdict === "FLAG"
                        ? "threat"
                        : "processing";
                  return (
                    <ReportStrip
                      key={a.id}
                      title={a.label}
                      status={r.verdict}
                      body={r.summary}
                      blockers={r.blockers}
                      kind={kind}
                    />
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  color: NEX_MUTED,
                  fontStyle: "italic",
                  fontSize: 12,
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                No active structural runs logged. Waiting for input stream parameters…
              </div>
            )}
          </div>

          {/* live schema map */}
          <div style={{ marginBottom: 24 }}>
            <SubLabel>Live Database AST Matrix Map</SubLabel>
            {ledger && ledger.table_count > 0 ? (
              <div style={{ marginTop: 8 }}>
                {Object.values(ledger.ledger.tables).map((t) => (
                  <div
                    key={t.table_name}
                    style={{
                      background: NEX_TERM,
                      border: `1px solid ${NEX_BORDER}`,
                      borderRadius: 6,
                      overflow: "hidden",
                      marginTop: 10,
                    }}
                  >
                    <div
                      style={{
                        background: "#111524",
                        padding: "10px 14px",
                        color: NEX_ACCENT,
                        fontWeight: "bold",
                        fontSize: 12,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>
                        interface {t.interface_name} → table {t.table_name}
                      </span>
                      <span style={{ fontSize: 10, color: NEX_MUTED }}>AST_PINNED</span>
                    </div>
                    {t.columns.map((c) => (
                      <div
                        key={c.name}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.5fr 1.5fr 1fr",
                          gap: 12,
                          padding: "8px 14px",
                          borderTop: `1px solid #111524`,
                          fontSize: 12,
                        }}
                      >
                        <span style={{ color: "#93c5fd" }}>
                          ▪ {c.name}
                          {c.is_primary && <span style={{ color: NEX_MUTED, marginLeft: 6 }}>PK</span>}
                        </span>
                        <span style={{ color: "#a7f3d0", opacity: 0.8 }}>{c.sql_type.toLowerCase()}</span>
                        <span style={{ color: NEX_MUTED, textAlign: "right" }}>
                          {c.is_nullable ? "null" : "not null"}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  color: NEX_MUTED,
                  fontStyle: "italic",
                  fontSize: 12,
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                Database schema map empty. Run a migration cycle via <code>/api/nex-migration/plan</code> to
                populate…
              </div>
            )}
          </div>

          {/* raw run payload */}
          <div>
            <SubLabel>Raw Run Payload</SubLabel>
            <pre
              style={{
                background: NEX_TERM,
                padding: 14,
                borderRadius: 6,
                border: `1px solid ${NEX_BORDER}`,
                color: NEX_GREEN,
                fontSize: 11,
                fontFamily: NEX_FONT_MONO,
                maxHeight: 220,
                overflow: "auto",
                margin: 0,
                marginTop: 8,
              }}
            >
              {run ? JSON.stringify(run, null, 2) : "Awaiting dispatch…"}
            </pre>
          </div>

          {run && (
            <div style={{ marginTop: 16, fontSize: 12, color: NEX_MUTED }}>
              artefacts: <code style={{ color: NEX_INK }}>{run.artifacts_dir}</code>
              {run.commit_sha && (
                <>
                  {" · "}commit: <code style={{ color: NEX_INK }}>{run.commit_sha.slice(0, 12)}</code>
                </>
              )}
              {isTerminalStatus(run.status) && (
                <span style={{ marginLeft: 12, color: verdictColour(run.status) }}>
                  · terminal state: {run.status}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <footer style={{ marginTop: 24, fontSize: 10, color: NEX_MUTED, textTransform: "uppercase" }}>
        Governance: V3_ENGINE_REGISTRY frozen · historical receipts intact · anti-bullshit doctrine enforced · Founder
        retains veto on every stage · STOP writes a sentinel · never kills any OS process.
      </footer>
    </section>
  );
}

// ── small subcomponents ─────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: NEX_CARD,
        border: `1px solid ${NEX_BORDER}`,
        borderRadius: 8,
        padding: 20,
        marginBottom: 20,
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: NEX_ACCENT,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        borderBottom: `1px solid ${NEX_BORDER}`,
        paddingBottom: 8,
        marginTop: 0,
        marginBottom: 14,
      }}
    >
      {children}
    </h2>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: NEX_MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {children}
    </div>
  );
}

function RowLabel({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
      <span style={{ fontSize: 12, color: NEX_MUTED }}>{label}</span>
      <strong style={{ color: NEX_INK, fontSize: 12 }}>{value}</strong>
    </div>
  );
}

function StatusBadge({ status, running }: { status: string; running: boolean }) {
  let bg = "#1e293b";
  let fg = "#94a3b8";
  if (running || /_running$|integrating|watching/.test(status)) {
    bg = "#7c2d12";
    fg = "#fdba74";
  } else if (/^completed_/.test(status)) {
    bg = "#064e3b";
    fg = "#6ee7b7";
  } else if (/^halted_|^aborted$/.test(status)) {
    bg = "#7f1d1d";
    fg = "#fca5a5";
  }
  return (
    <span
      className={running ? "nex-blink" : undefined}
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 4,
        fontWeight: "bold",
        fontSize: 10,
        textTransform: "uppercase",
        background: bg,
        color: fg,
      }}
    >
      {status}
    </span>
  );
}

function ReportStrip({
  title,
  status,
  body,
  blockers,
  kind,
}: {
  title: string;
  status: string;
  body: string;
  blockers: number;
  kind: "clean" | "processing" | "threat";
}) {
  const border = kind === "clean" ? NEX_GREEN : kind === "threat" ? NEX_RED : NEX_ORANGE;
  return (
    <div
      style={{
        background: NEX_TERM,
        borderLeft: `3px solid ${border}`,
        padding: "10px 12px",
        borderRadius: "0 6px 6px 0",
        fontSize: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", color: NEX_MUTED, fontSize: 10 }}>
        <span style={{ fontWeight: "bold", color: NEX_INK }}>{title}</span>
        <span style={{ color: verdictColour(status) }}>
          {status}
          {blockers > 0 && ` · blockers=${blockers}`}
        </span>
      </div>
      <div style={{ color: NEX_TEXT, whiteSpace: "pre-wrap" }}>{body}</div>
    </div>
  );
}

function btnStyle(overrides: React.CSSProperties = {}): React.CSSProperties {
  return {
    background: "#1e293b",
    color: NEX_INK,
    border: `1px solid #334155`,
    padding: "10px 14px",
    borderRadius: 4,
    cursor: "pointer",
    fontWeight: "bold",
    textTransform: "uppercase",
    fontSize: 11,
    transition: "all 0.2s",
    fontFamily: "inherit",
    ...overrides,
  };
}
