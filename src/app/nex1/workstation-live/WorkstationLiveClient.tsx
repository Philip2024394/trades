// §36-W-1 · WAVE-W1 · 2026-09-14 · workstation-live
//
// NEX1 Workstation · Live Engineering Cockpit · Client
//
// Two-pane layout:
//  - LEFT: live application preview iframe pointed at the caller-chosen route
//          (same origin dev server · Next.js Fast Refresh works when files
//          change). Preview reachability is checked via a real HTTP probe.
//  - RIGHT: real orchestrator engineering state (mission, plan, stage
//          statuses, audit trail, founder controls) streamed live via SSE
//          from the actual trace-store. Real git-diff summary from
//          /api/nex1/workstation-live/changes.
//
// ABSOLUTE RULE: no fabricated state. Anything not connected → NOT_CONNECTED.

"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowTrace, StageId, StageStatus } from "@/lib/nex1-orchestrator/types";
// Consolidated 2026-09-16 · migrated verbatim from the retired
// /nex-head-quarters/coding-team page per NEX Workstation Consolidation Directive.
import { CodingTeamPanel } from "./panels/CodingTeamPanel";
// 2026-09-19 · NEX chat surface mounted directly under the LIVE APP PREVIEW
// per founder directive. Talks to /api/nex1/chat/turn (NEX1 native runtime).
import Nex1WorkstationChat from "@/components/nex1/Nex1WorkstationChat";

// §36-W-2 · WAVE-W2 · 2026-09-14 · workstation-cockpit
// NEX bounded infrastructure · W2 additive types for cockpit-state view

interface CockpitStateResponse {
  ok: boolean;
  view: {
    engineering_activity: string;
    lifecycle_state: string | null;
    error_diagnosis: null | {
      error_kind: string;
      error_summary: string;
      affected_files: readonly string[];
      suggested_files: readonly { path: string; reason: string; proposed_action: string }[];
      epistemic_status: string;
      derived_from: readonly string[];
    };
    file_change_ledger: readonly {
      path: string;
      action: string;
      status: string;
      triggered_by_activity: string | null;
      evidence_ref: string | null;
    }[];
    preview_causal_link: null | {
      preview_target_url: string;
      triggered_by_file: string | null;
      triggered_by_activity: string | null;
      preview_nonce: number;
      last_updated_at: string | null;
    };
    not_connected_surfaces: readonly { surface: string; reason: string }[];
    derivation_sha256: string;
    grep_marker: string;
  };
  source_probe: {
    trace_id: string | null;
    trace_present: boolean;
    git_changes_present: boolean;
    git_changes_reason?: string;
  };
  captured_at: string;
}

// §36-W-2 · WAVE-W2 · bounded app target catalogue (locked)
// §36-2D-a UX addendum · targets may carry an OPTIONAL absolute preview_origin.
// When set, the iframe uses `${preview_origin}${route}` instead of the relative
// route. This lets the Workstation preview an app running on a DIFFERENT port
// than the Workstation itself (e.g., Workstation on 3000, generated app on 3008)
// without any additional infrastructure — the existing preview-status endpoint
// already accepts absolute URLs. If preview_origin is null, the iframe uses the
// route relative to the Workstation's own origin (same-origin default).
interface BoundedAppTarget {
  readonly slug: string;
  readonly label: string;
  readonly route: string;
  readonly preview_origin: string | null;  // e.g. "http://localhost:3008" · null → same-origin
  readonly kind: "nex1-authored-contract-viewer" | "site-root";
}
const BOUNDED_APP_TARGETS: readonly BoundedAppTarget[] = Object.freeze([
  { slug: "tiny-calculator", label: "NEX1 Tiny Calculator (Route 2d small-app demo)", route: "/nex-generated/tiny-calculator", preview_origin: null, kind: "nex1-authored-contract-viewer" },
  { slug: "mission-priority-viewer", label: "NEX1 Mission Priority Viewer (contract demo)", route: "/nex-mission-priority-viewer", preview_origin: null, kind: "nex1-authored-contract-viewer" },
  { slug: "site-root", label: "Site root /", route: "/", preview_origin: null, kind: "site-root" },
]);

// Full preview URL resolver · absolute origin wins, else relative-to-workstation.
function resolvePreviewUrl(target: BoundedAppTarget): string {
  if (target.preview_origin && target.preview_origin.length > 0) {
    // Absolute URL: origin + route. Trim trailing "/" on origin.
    const origin = target.preview_origin.replace(/\/$/, "");
    return `${origin}${target.route}`;
  }
  return target.route; // same-origin relative
}

// ── Locked stage order (mirrors existing /nex1/workstation page) ───────
const ORDER: StageId[] = [
  "REQUEST_RECEIVED",
  "UNDERSTANDING",
  "REQUIREMENTS",
  "WORK_ORDER",
  "ARCHITECTURE",
  "DESIGN",
  "BUILD_PLAN",
  "SPECIALIST_EVIDENCE",
  "EVIDENCE_VALIDATION",
  "NEX2_REVIEW",
  "NEX3_ARBITRATION",
  "FOUNDER_DECISION",
  "EXECUTION",
  "VERIFICATION",
  "RELEASE",
  "ORCHESTRATION_COMPLETED",
  "DELIVERABLE_COMPLETED",
];

function statusGlyph(s: StageStatus | undefined): string {
  if (!s) return "○ PENDING";
  if (s === "COMPLETE") return "✓ COMPLETE";
  if (s === "RUNNING") return "● RUNNING";
  if (s === "BLOCKED") return "✗ BLOCKED";
  if (s === "REJECTED") return "✗ REJECTED";
  if (s === "HOLD") return "⏸ HOLD";
  if (s === "NOT_IMPLEMENTED") return "○ NOT_IMPLEMENTED";
  if (s === "LIMITED_V0") return "⚠ LIMITED_V0";
  return "○ PENDING";
}

interface ChangesResponse {
  connected: boolean;
  reason?: string;
  cwd: string;
  changes: readonly { status: string; path: string }[];
  added: number;
  modified: number;
  deleted: number;
  untracked: number;
  stat_summary: string | null;
  captured_at: string;
}

interface PreviewStatus {
  target_url: string;
  reachable: boolean;
  http_status: number | null;
  content_length: number | null;
  probed_at: string;
  duration_ms: number;
  reason: string | null;
}

type StreamStatus = "IDLE" | "CONNECTING" | "LIVE" | "NOT_CONNECTED" | "ERROR";

export default function WorkstationLiveClient() {
  // ── State ────────────────────────────────────────────────────────────
  const [request, setRequest] = useState<string>(
    "Add a small visible copyright timestamp to the site footer showing the current year, with a unit test that verifies the year displayed matches the current year at render time."
  );
  // §36-2D-a UX integration · default the preview to the Route 2d tiny-calculator so
  // the Workstation cockpit boots with a REAL running app on the LEFT out of the box.
  // The initial value is derived from the tiny-calculator bounded target so any
  // preview_origin override applies from first render.
  const initialTarget = BOUNDED_APP_TARGETS.find((t) => t.slug === "tiny-calculator") ?? BOUNDED_APP_TARGETS[0];
  const initialPreviewUrl = resolvePreviewUrl(initialTarget);
  const [previewTarget, setPreviewTarget] = useState<string>(initialPreviewUrl);
  const [previewIframeSrc, setPreviewIframeSrc] = useState<string>(initialPreviewUrl);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus | null>(null);
  const [previewCheckedAt, setPreviewCheckedAt] = useState<string>("");
  const [trace, setTrace] = useState<WorkflowTrace | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("IDLE");
  const [streamLastEventAt, setStreamLastEventAt] = useState<string>("");
  const [changes, setChanges] = useState<ChangesResponse | null>(null);
  const [changesCheckedAt, setChangesCheckedAt] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [autoRefreshPreview, setAutoRefreshPreview] = useState<boolean>(true);
  const [previewNonce, setPreviewNonce] = useState<number>(0);
  // §36-W-2 · derived cockpit state (activity + error diagnosis + file ledger)
  const [cockpitState, setCockpitState] = useState<CockpitStateResponse | null>(null);
  const [cockpitCheckedAt, setCockpitCheckedAt] = useState<string>("");
  // §36-2D-a UX integration · default to the tiny-calculator so the workstation
  // boots with a real running Route 2d app on the LEFT.
  const [boundedTargetSlug, setBoundedTargetSlug] = useState<string>("tiny-calculator");
  // §36-W-3 · REAL command surface (2026-09-15)
  // The SEND button hits POST /api/nex1/workstation-live/execute-command.
  // The API runs the §36-CMD-1 parser · then the §36-W-3 execution bridge.
  // Result is either a real refusal from parser/executor OR a real lifecycle
  // record with real file writes + real test run.
  interface CommandHistoryEntry {
    readonly at: string;
    readonly command: string;
    // Parser result
    readonly parser_ok: boolean;
    readonly parser_refusal?: string;
    readonly parser_reason?: string;
    readonly parser_amendment?: string;
    readonly matched_phrase_id?: string;
    readonly structured?: { readonly target_app: string; readonly element: string; readonly property: string; readonly value: string };
    // Execute result (only when parser_ok)
    readonly execute_ok?: boolean;
    readonly execute_refusal?: string;
    readonly execute_reason?: string;
    readonly file_writes?: readonly { readonly path: string; readonly action: string; readonly byte_size: number }[];
    readonly test_run?: { readonly command: string; readonly exit_code: number | null; readonly duration_ms: number; readonly passed: boolean; readonly stdout_tail: string };
    readonly lifecycle_history?: readonly { readonly at: string; readonly state: string; readonly note: string }[];
    readonly preview_refresh_nonce?: number;
  }
  const [commandHistory, setCommandHistory] = useState<readonly CommandHistoryEntry[]>([]);
  const [commandInput, setCommandInput] = useState<string>("");
  const [commandBusy, setCommandBusy] = useState<boolean>(false);

  // ── Preview health check (real HTTP probe) ───────────────────────────
  const checkPreview = useCallback(async () => {
    try {
      const url = `/api/nex1/workstation-live/preview-status?target=${encodeURIComponent(previewTarget)}`;
      const res = await fetch(url, { cache: "no-store" });
      const j = (await res.json()) as PreviewStatus;
      setPreviewStatus(j);
      setPreviewCheckedAt(new Date().toISOString());
    } catch (e) {
      setPreviewStatus({
        target_url: previewTarget,
        reachable: false,
        http_status: null,
        content_length: null,
        probed_at: new Date().toISOString(),
        duration_ms: 0,
        reason: `client_error:${(e as Error).message.slice(0, 60)}`,
      });
      setPreviewCheckedAt(new Date().toISOString());
    }
  }, [previewTarget]);

  // ── Real git-diff fetch ───────────────────────────────────────────────
  const fetchChanges = useCallback(async () => {
    try {
      const res = await fetch("/api/nex1/workstation-live/changes", { cache: "no-store" });
      const j = (await res.json()) as ChangesResponse;
      setChanges(j);
      setChangesCheckedAt(new Date().toISOString());
    } catch (e) {
      setChanges({
        connected: false,
        reason: `client_error:${(e as Error).message.slice(0, 60)}`,
        cwd: "",
        changes: [],
        added: 0,
        modified: 0,
        deleted: 0,
        untracked: 0,
        stat_summary: null,
        captured_at: new Date().toISOString(),
      });
      setChangesCheckedAt(new Date().toISOString());
    }
  }, []);

  // Poll preview + changes every 5s
  useEffect(() => {
    void checkPreview();
    void fetchChanges();
    const id = setInterval(() => {
      void checkPreview();
      void fetchChanges();
    }, 5000);
    return () => clearInterval(id);
  }, [checkPreview, fetchChanges]);

  // §36-W-2 · Poll derived cockpit state every 5s
  const fetchCockpitState = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (trace?.trace_id) params.set("trace_id", trace.trace_id);
      params.set("preview_target", previewTarget);
      params.set("preview_nonce", String(previewNonce));
      const res = await fetch(`/api/nex1/workstation-live/cockpit-state?${params.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as CockpitStateResponse;
      setCockpitState(j);
      setCockpitCheckedAt(new Date().toISOString());
    } catch {
      setCockpitState(null);
      setCockpitCheckedAt(new Date().toISOString());
    }
  }, [trace?.trace_id, previewTarget, previewNonce]);

  useEffect(() => {
    void fetchCockpitState();
    const id = setInterval(() => void fetchCockpitState(), 5000);
    return () => clearInterval(id);
  }, [fetchCockpitState]);

  // Auto-refresh iframe when git changes count changes
  const changesSignature = useMemo(() => {
    if (!changes || !changes.connected) return "";
    return `${changes.added}|${changes.modified}|${changes.deleted}|${changes.untracked}`;
  }, [changes]);
  const lastSignatureRef = useRef<string>("");
  useEffect(() => {
    if (!autoRefreshPreview) return;
    if (changesSignature && changesSignature !== lastSignatureRef.current) {
      lastSignatureRef.current = changesSignature;
      setPreviewNonce((n) => n + 1);
    }
  }, [changesSignature, autoRefreshPreview]);

  // ── Submit mission (uses existing orchestrator submit endpoint) ──────
  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    setTrace(null);
    try {
      const r = await fetch("/api/nex1/orchestrator/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_request: request }),
      });
      const j = (await r.json()) as WorkflowTrace | { error: string };
      if (!r.ok || "error" in j) {
        setError("error" in j ? j.error : "submit_failed");
      } else {
        setTrace(j as WorkflowTrace);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [request]);

  // ── Founder decision (uses existing orchestrator decision endpoint) ──
  const decide = useCallback(
    async (decision: "AUTHORISE" | "REJECT" | "HOLD") => {
      if (!trace) return;
      setBusy(true);
      setError(null);
      try {
        const r = await fetch("/api/nex1/orchestrator/decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trace_id: trace.trace_id,
            decision,
            founder_authorisation_token:
              decision === "AUTHORISE" ? `FA-WORKSTATION-LIVE-${Date.now().toString(36)}` : "",
            reason:
              decision === "AUTHORISE"
                ? "founder authorised via live workstation"
                : `founder ${decision.toLowerCase()} via live workstation`,
          }),
        });
        const j = (await r.json()) as WorkflowTrace | { error: string };
        if (!r.ok || "error" in j) setError("error" in j ? j.error : "decision_failed");
        else setTrace(j as WorkflowTrace);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [trace],
  );

  // ── SSE event stream (connect when trace exists) ─────────────────────
  useEffect(() => {
    if (!trace) {
      setStreamStatus("IDLE");
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }
    setStreamStatus("CONNECTING");
    const es = new EventSource(`/api/nex1/workstation-live/events/${encodeURIComponent(trace.trace_id)}`);
    eventSourceRef.current = es;

    es.addEventListener("trace", (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as { ok: boolean; trace?: WorkflowTrace; connected?: boolean };
        if (parsed.ok && parsed.trace) {
          setTrace(parsed.trace);
          setStreamStatus("LIVE");
          setStreamLastEventAt(new Date().toISOString());
        }
      } catch {
        // ignore malformed frame
      }
    });
    es.addEventListener("not-connected", () => {
      setStreamStatus("NOT_CONNECTED");
      setStreamLastEventAt(new Date().toISOString());
    });
    es.addEventListener("heartbeat", () => {
      setStreamLastEventAt(new Date().toISOString());
    });
    es.onerror = () => {
      setStreamStatus("ERROR");
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [trace?.trace_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived: mission state + preview state labels ────────────────────
  const missionState = trace?.current_state ?? "NO_MISSION";
  const previewLabel: string = useMemo(() => {
    if (!previewStatus) return "CHECKING…";
    if (previewStatus.reachable && (previewStatus.http_status ?? 0) < 400) return "REACHABLE";
    if (previewStatus.reason === "timeout") return "TIMEOUT";
    if (previewStatus.reason?.startsWith("fetch_error")) return "UNREACHABLE";
    return `HTTP_${previewStatus.http_status ?? "?"}`;
  }, [previewStatus]);

  const previewIframeUrl = useMemo(() => {
    // Append nonce to bust cache on Fast Refresh events; use hash to avoid
    // extra HTTP request on every mount.
    return `${previewIframeSrc}${previewIframeSrc.includes("#") ? "&" : "#"}_ws=${previewNonce}`;
  }, [previewIframeSrc, previewNonce]);

  const applyPreviewTarget = useCallback(() => {
    setPreviewIframeSrc(previewTarget);
    setPreviewNonce((n) => n + 1);
    void checkPreview();
  }, [previewTarget, checkPreview]);

  const manualRefreshPreview = useCallback(() => {
    setPreviewNonce((n) => n + 1);
    void checkPreview();
  }, [checkPreview]);

  // §36-W-2-b REPLACEMENT · honest deterministic command-feasibility check.
  //
  // On send, we do a real client-side lookup against the sealed Route 2d
  // vocabulary. If the requested change is not representable, we emit a
  // REFUSED verdict citing the exact missing primitive + §36 amendment.
  // We NEVER execute anything, invoke any primitive, or write any file.
  // Every response is a REAL refusal, not a mock echo.
  //
  // This surface exists to expose the pipeline boundary honestly per the
  // founder's 2026-09-15 correction: "if Claude comes back saying this
  // requires §36-W-3, that's actually useful evidence."
  // §36-W-3 · REAL send handler: POST to /api/nex1/workstation-live/execute-command.
  // Parser + execution bridge run server-side; real file writes; real vitest.
  const sendCommand = useCallback(async () => {
    const text = commandInput.trim();
    if (text.length === 0) return;
    const now = new Date().toISOString();
    setCommandBusy(true);
    try {
      const res = await fetch("/api/nex1/workstation-live/execute-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command_text: text,
          authorisation_ref: `founder-workstation-${Date.now().toString(36)}`,
        }),
      });
      const body = await res.json();
      const entry: CommandHistoryEntry = { at: now, command: text, parser_ok: Boolean(body?.parser?.ok) };
      if (body?.parser?.ok) {
        Object.assign(entry, {
          matched_phrase_id: body.parser.matched_phrase_id,
          structured: body.parser.structured,
          execute_ok: Boolean(body?.execute?.ok),
        });
        if (body.execute?.ok) {
          Object.assign(entry, {
            file_writes: body.execute.file_writes,
            test_run: body.execute.test_run,
            lifecycle_history: body.execute.lifecycle_history,
            preview_refresh_nonce: body.execute.preview_refresh_nonce,
          });
          // Real preview refresh
          setPreviewNonce((n) => n + 1);
          void checkPreview();
          void fetchChanges();
        } else {
          Object.assign(entry, {
            execute_refusal: body?.execute?.refusal_code,
            execute_reason: body?.execute?.reason,
            file_writes: body?.execute?.diagnosis?.attempted_writes,
            test_run: body?.execute?.diagnosis?.test_run,
            lifecycle_history: body?.execute?.lifecycle_history,
          });
        }
      } else {
        Object.assign(entry, {
          parser_refusal: body?.parser?.refusal_code,
          parser_reason: body?.parser?.reason,
          parser_amendment: body?.parser?.suggested_amendment,
        });
      }
      setCommandHistory((prev) => [...prev, entry]);
      setCommandInput("");
    } catch (e) {
      const entry: CommandHistoryEntry = {
        at: now,
        command: text,
        parser_ok: false,
        parser_refusal: "NETWORK_ERROR",
        parser_reason: (e as Error).message.slice(0, 200),
      };
      setCommandHistory((prev) => [...prev, entry]);
    } finally {
      setCommandBusy(false);
    }
  }, [commandInput, checkPreview, fetchChanges]);

  // ── Rendering ────────────────────────────────────────────────────────
  return (
    <>
      {/* ═════════════════ CODING TEAM DISPATCH (consolidated 2026-09-16) ═════════════════
          Founder-order dispatch panel · migrated from /nex-head-quarters/coding-team.
          Rendered as a full-width band above the 2-column preview/engineering split
          so it is the first thing the Founder sees on entering the workstation. */}
      <CodingTeamPanel />
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 0,
        minHeight: "100vh",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12,
        color: "#111",
        background: "#f8f8f8",
      }}
    >
      {/* ═════════════════ LEFT · LIVE APPLICATION PREVIEW ═════════════════ */}
      <section
        style={{
          borderRight: "1px solid #ccc",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        <header
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid #ddd",
            background: "#f4f4f4",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <strong style={{ fontSize: 12 }}>LIVE APP PREVIEW</strong>
          <span
            style={{
              padding: "2px 6px",
              borderRadius: 2,
              background: previewLabel === "REACHABLE" ? "#e6ffe6" : "#ffe6e6",
              color: previewLabel === "REACHABLE" ? "#0a5" : "#a00",
              fontSize: 11,
            }}
          >
            {previewLabel}
          </span>
          <span style={{ fontSize: 10, color: "#666" }}>
            HTTP {previewStatus?.http_status ?? "?"} · {previewStatus?.duration_ms ?? 0}ms
          </span>
          <span style={{ fontSize: 10, color: "#666" }}>
            probed: {previewCheckedAt ? previewCheckedAt.slice(11, 19) : "—"}
          </span>
          <span style={{ flexGrow: 1 }} />
          <label style={{ fontSize: 10, color: "#666" }}>
            <input
              type="checkbox"
              checked={autoRefreshPreview}
              onChange={(e) => setAutoRefreshPreview(e.target.checked)}
              style={{ verticalAlign: "middle" }}
            />{" "}
            auto-refresh on git change
          </label>
          <button onClick={manualRefreshPreview} style={{ padding: "2px 8px", fontSize: 11 }}>
            REFRESH
          </button>
        </header>
        {/* §36-2D-a · Preview source indicator · shows the real URL loaded in the iframe */}
        <div
          style={{
            padding: "4px 12px",
            background: "#eef4ff",
            borderBottom: "1px solid #d8e3f5",
            fontSize: 11,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <strong style={{ color: "#036" }}>PREVIEW SOURCE:</strong>
          <code style={{ background: "#fff", padding: "1px 6px", border: "1px solid #cbd5e1" }}>
            {previewIframeSrc}
          </code>
          <span style={{ color: "#666", fontSize: 10 }}>
            {BOUNDED_APP_TARGETS.find((t) => resolvePreviewUrl(t) === previewIframeSrc)?.label ?? "custom target"}
          </span>
          <span style={{ flexGrow: 1 }} />
          <span
            style={{
              padding: "1px 6px",
              background: previewLabel === "REACHABLE" ? "#e6ffe6" : "#fff0f0",
              color: previewLabel === "REACHABLE" ? "#0a5" : "#a00",
              fontSize: 10,
              borderRadius: 2,
            }}
          >
            {previewLabel === "REACHABLE" ? "CONNECTED · real app" : "NOT_CONNECTED"}
          </span>
        </div>
        <div
          style={{
            padding: "6px 12px",
            borderBottom: "1px solid #eee",
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          {/* §36-W-2 · bounded app target picker · auto-loads iframe on change */}
          <label style={{ fontSize: 11, color: "#555" }}>bounded target:</label>
          <select
            value={boundedTargetSlug}
            onChange={(e) => {
              const slug = e.target.value;
              setBoundedTargetSlug(slug);
              const t = BOUNDED_APP_TARGETS.find((x) => x.slug === slug);
              if (t) {
                // §36-2D-a UX: auto-load — dropdown change immediately updates the iframe.
                // Uses resolvePreviewUrl so an absolute preview_origin (if configured)
                // is honoured; otherwise same-origin relative path.
                const url = resolvePreviewUrl(t);
                setPreviewTarget(url);
                setPreviewIframeSrc(url);
                setPreviewNonce((n) => n + 1);
                void checkPreview();
              }
            }}
            style={{ fontFamily: "inherit", fontSize: 11, padding: "2px 4px" }}
          >
            {BOUNDED_APP_TARGETS.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
          </select>
          <label style={{ fontSize: 11, color: "#555" }}>target route or absolute URL:</label>
          <input
            value={previewTarget}
            onChange={(e) => setPreviewTarget(e.target.value)}
            style={{ flexGrow: 1, fontFamily: "inherit", fontSize: 11, padding: "2px 4px" }}
            placeholder="/nex-generated/tiny-calculator OR http://localhost:3008/..."
          />
          <button onClick={applyPreviewTarget} style={{ padding: "2px 8px", fontSize: 11 }}>
            LOAD
          </button>
        </div>
        <div
          style={{
            flexGrow: 1,
            background: "#fff",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {previewStatus && !previewStatus.reachable ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 20,
                color: "#a00",
                background: "#fff8f8",
              }}
            >
              <div style={{ fontSize: 14, marginBottom: 8, fontWeight: 600 }}>PREVIEW NOT_CONNECTED</div>
              <div style={{ fontSize: 12 }}>{previewStatus.reason ?? "unreachable"}</div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
                target: <code>{previewStatus.target_url}</code>
              </div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                (No fabricated preview shown. Start the Next.js dev server and reload target.)
              </div>
            </div>
          ) : (
            <iframe
              key={previewNonce}
              src={previewIframeUrl}
              title="Live application preview"
              style={{ width: "100%", height: "100%", border: "0", display: "block" }}
              // Use "no-referrer-when-downgrade" and no sandbox for same-origin dev preview.
              // We control this content; not fetching untrusted third-party.
            />
          )}
          {/* §36-W-2-b mock overlays removed 2026-09-15 · no fake pulse · no fake caption */}
        </div>
        {/* ═════ NEX CHAT · directly under LIVE APP PREVIEW · founder 2026-09-19 ═════
            Real Nex1WorkstationChat component · talks to /api/nex1/chat/turn (NEX1
            native runtime · zero LLM). The workstation's primary chat surface now
            sits underneath the preview so the user talks to NEX while looking at
            the app being built. */}
        <div
          style={{
            borderTop: "2px solid #cbd5e1",
            background: "#fff",
            minHeight: 320,
            maxHeight: 480,
            display: "flex",
            flexDirection: "column",
          }}
          aria-label="NEX chat · directly under live preview"
        >
          <div
            style={{
              padding: "6px 12px",
              background: "#eef4ff",
              borderBottom: "1px solid #d8e3f5",
              fontSize: 11,
              fontWeight: 600,
              color: "#036",
            }}
          >
            NEX CHAT · talk to NEX about the app above
          </div>
          <div style={{ flexGrow: 1, overflow: "hidden" }}>
            <Nex1WorkstationChat />
          </div>
        </div>
      </section>

      {/* ═════════════════ RIGHT · ENGINEERING CONTROL AREA ═════════════════ */}
      <section style={{ display: "flex", flexDirection: "column", minHeight: "100vh", overflow: "auto" }}>
        <div style={{ padding: 12, background: "#fff", borderBottom: "1px solid #ddd" }}>
          <h1 style={{ fontSize: 14, margin: 0 }}>NEX1 WORKSTATION · LIVE ENGINEERING COCKPIT</h1>
          <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
            Left · real application preview iframe with real HTTP-probe reachability. Right ·
            real orchestrator state via SSE + real git-diff. No fabricated states.
          </div>
        </div>

        {/* ─── A · TASK ─────────────────────────────────────────────────────── */}
        <section style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fff" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>A · TASK</div>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={3}
            style={{ width: "100%", fontFamily: "inherit", fontSize: 11, padding: 4 }}
            disabled={busy}
          />
          <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
            <button
              onClick={submit}
              disabled={busy || request.trim().length === 0}
              style={{ padding: "4px 12px" }}
            >
              {busy ? "…" : "SUBMIT TASK"}
            </button>
            <span style={{ fontSize: 11, color: "#666" }}>
              mission: {trace?.trace_id ? <code>{trace.trace_id}</code> : "NO_MISSION"}
            </span>
          </div>
          {error && (
            <div style={{ color: "crimson", marginTop: 6, fontSize: 11 }}>ERROR: {error}</div>
          )}
        </section>

        {/* ─── B · NEX1 STATE + STREAM ──────────────────────────────────────── */}
        <section style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fff" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>B · NEX1 STATE + EVENT STREAM</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 11 }}>
            <div>mission_state</div>
            <div>
              <code>{missionState}</code>
            </div>
            <div>stream</div>
            <div>
              <code>{streamStatus}</code>
              {streamLastEventAt && (
                <span style={{ color: "#666", marginLeft: 8 }}>
                  last: {streamLastEventAt.slice(11, 19)}
                </span>
              )}
            </div>
            <div>founder_decision</div>
            <div>
              <code>{trace?.founder_decision ?? "(awaiting)"}</code>
            </div>
            <div>nex2_review_id</div>
            <div>
              <code>{trace?.nex2_review_id ?? "(pending)"}</code>
            </div>
            <div>nex3_verdict</div>
            <div>
              <code>{trace?.nex3_verdict ?? "(pending)"}</code>
            </div>
          </div>
        </section>

        {/* §36-W-2 · ─── B2 · ENGINEERING ACTIVITY (derived cockpit state) ─── */}
        <section style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fff" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>B2 · ENGINEERING ACTIVITY</div>
          {cockpitState && cockpitState.ok ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 11 }}>
                <div>activity</div>
                <div>
                  <code
                    style={{
                      padding: "2px 6px",
                      borderRadius: 2,
                      background:
                        cockpitState.view.engineering_activity === "COMPLETED"
                          ? "#e6ffe6"
                          : cockpitState.view.engineering_activity === "FAILED" ||
                            cockpitState.view.engineering_activity === "ERROR_FOUND" ||
                            cockpitState.view.engineering_activity === "REFUSED"
                          ? "#ffe6e6"
                          : cockpitState.view.engineering_activity === "IDLE"
                          ? "#f0f0f0"
                          : "#e6f0ff",
                      color:
                        cockpitState.view.engineering_activity === "COMPLETED"
                          ? "#0a5"
                          : cockpitState.view.engineering_activity === "FAILED" ||
                            cockpitState.view.engineering_activity === "ERROR_FOUND" ||
                            cockpitState.view.engineering_activity === "REFUSED"
                          ? "#a00"
                          : "#036",
                    }}
                  >
                    {cockpitState.view.engineering_activity}
                  </code>
                </div>
                <div>lifecycle</div>
                <div><code>{cockpitState.view.lifecycle_state ?? "(none · lifecycle not yet integrated with orchestrator trace)"}</code></div>
                <div>derivation_sha</div>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#666" }}>
                  {cockpitState.view.derivation_sha256.slice(0, 16)}…
                </div>
                <div>checked</div>
                <div style={{ fontSize: 10, color: "#666" }}>{cockpitCheckedAt ? cockpitCheckedAt.slice(11, 19) : "—"}</div>
              </div>
              {cockpitState.view.not_connected_surfaces.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 10, color: "#a60" }}>
                  NOT_CONNECTED:{" "}
                  {cockpitState.view.not_connected_surfaces.map((n) => n.surface).join(" · ")}
                </div>
              )}
              {cockpitState.view.engineering_activity === "IDLE" && !trace && (
                <div style={{ marginTop: 8, padding: 8, background: "#eefff0", border: "1px solid #b7e0c0", fontSize: 11, color: "#0a5" }}>
                  <strong>§36-W-3 REAL COMMAND SURFACE ACTIVE.</strong> Type a supported English command; the parser
                  translates it deterministically, the execution bridge writes real bytes to the tiny-calculator, runs
                  real vitest, and refreshes the preview. Only phrases in the locked v1 table are understood — everything
                  else refuses with a specific §36 amendment. See
                  <code style={{ marginLeft: 4 }}>docs/NEX1/SECTION_36_CMD_1_BOUNDED_COMMAND_PARSER_AMENDMENT.md</code>
                  and
                  <code style={{ marginLeft: 4 }}>docs/NEX1/SECTION_36_W_3_WORKSTATION_REAL_EXECUTION_BRIDGE_AMENDMENT.md</code>.
                </div>
              )}

              {/* §36-W-3 · REAL command surface */}
              {cockpitState.view.engineering_activity === "IDLE" && !trace && (
                <div style={{ marginTop: 8 }}>
                  {/* Command history · shows parser + executor lifecycle */}
                  <div
                    style={{
                      maxHeight: 400,
                      overflowY: "auto",
                      border: "1px solid #ddd",
                      borderRadius: 3,
                      padding: commandHistory.length > 0 ? 8 : 0,
                      background: "#fafafa",
                      marginBottom: 6,
                      fontSize: 11,
                    }}
                  >
                    {commandHistory.length === 0 ? (
                      <div style={{ padding: 8, color: "#999", fontStyle: "italic", fontSize: 11 }}>
                        (no commands submitted yet · try &quot;make the calculator buttons rounded&quot; and press SEND)
                      </div>
                    ) : (
                      commandHistory.map((entry, i) => {
                        const succeeded = entry.parser_ok && entry.execute_ok;
                        const bg = succeeded ? "#eefff0" : "#fff5f5";
                        const border = succeeded ? "#b7e0c0" : "#f4b1b1";
                        const color = succeeded ? "#0a5" : "#7a2020";
                        return (
                          <div key={i} style={{ marginBottom: 8, padding: 8, background: bg, border: `1px solid ${border}`, borderRadius: 3, color }}>
                            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
                              {succeeded ? "COMPLETED · REAL EXECUTION" : entry.parser_ok ? `REFUSED · ${entry.execute_refusal ?? "EXECUTE_FAILED"}` : `REFUSED · ${entry.parser_refusal ?? "PARSER"}`} · {entry.at.slice(11, 19)}
                            </div>
                            <div style={{ marginBottom: 6, fontFamily: "monospace", fontSize: 11, color: "#036", background: "#eef4ff", padding: "2px 6px", borderRadius: 2 }}>
                              &gt; {entry.command}
                            </div>
                            {entry.parser_ok && entry.structured && (
                              <div style={{ marginBottom: 6, fontSize: 10, color: "#036" }}>
                                <strong>parsed →</strong> <code>{entry.matched_phrase_id}</code> ·
                                target=<code>{entry.structured.target_app}</code> ·
                                element=<code>{entry.structured.element}</code> ·
                                property=<code>{entry.structured.property}</code> ·
                                value=<code>{entry.structured.value}</code>
                              </div>
                            )}
                            {!entry.parser_ok && (
                              <>
                                <div style={{ marginBottom: 4 }}><strong>parser refusal:</strong> {entry.parser_reason}</div>
                                {entry.parser_amendment && (
                                  <div style={{ fontSize: 10, background: "#fff", padding: "2px 6px", border: "1px dashed #a00", marginBottom: 4 }}>
                                    <strong>amendment:</strong> {entry.parser_amendment}
                                  </div>
                                )}
                              </>
                            )}
                            {entry.parser_ok && !entry.execute_ok && (
                              <div style={{ marginBottom: 4 }}><strong>executor refusal:</strong> {entry.execute_reason}</div>
                            )}
                            {entry.lifecycle_history && entry.lifecycle_history.length > 0 && (
                              <div style={{ marginTop: 6, fontSize: 10, background: "#fff", padding: "4px 6px", border: "1px solid #dfe4ee", borderRadius: 2, color: "#333" }}>
                                <strong>lifecycle:</strong>
                                <ol style={{ margin: "4px 0 0 16px", padding: 0 }}>
                                  {entry.lifecycle_history.map((h, j) => (
                                    <li key={j} style={{ fontSize: 10 }}>
                                      <code>{h.state}</code> · {h.note}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                            {entry.file_writes && entry.file_writes.length > 0 && (
                              <div style={{ marginTop: 6, fontSize: 10 }}>
                                <strong>files:</strong>
                                <ul style={{ margin: "2px 0 0 16px" }}>
                                  {entry.file_writes.map((w, j) => (
                                    <li key={j}><code>{w.path}</code> · <span style={{ padding: "0 4px", background: w.action === "MODIFIED" ? "#fff5d6" : w.action === "CREATED" ? "#eefff0" : "#f0f0f0" }}>{w.action}</span> · {w.byte_size} bytes</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {entry.test_run && (
                              <div style={{ marginTop: 6, fontSize: 10 }}>
                                <strong>test run:</strong> <code>{entry.test_run.command}</code> · exit=<code>{entry.test_run.exit_code}</code> · {entry.test_run.duration_ms}ms · {entry.test_run.passed ? <span style={{ color: "#0a5" }}>PASS</span> : <span style={{ color: "#a00" }}>FAIL</span>}
                                {entry.test_run.stdout_tail && (
                                  <pre style={{ marginTop: 4, padding: 6, background: "#fff", border: "1px solid #ddd", fontSize: 9, maxHeight: 120, overflow: "auto" }}>{entry.test_run.stdout_tail}</pre>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  {/* Composer input + SEND button moved to LEFT panel under LIVE PREVIEW · 2026-09-19.
                      This right-side area now serves as the receipts/history menu · the primary
                      interaction surface is the composer directly beneath the preview iframe. */}
                  <div style={{
                    marginTop: 4,
                    fontSize: 10,
                    color: "#666",
                    padding: "6px 8px",
                    background: "#f4f7ff",
                    border: "1px dashed #cbd5e1",
                    borderRadius: 3,
                  }}>
                    Composer moved · type below the LIVE PREVIEW ↖. This panel now shows command history + engineering activity.
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 11, color: "#888" }}>cockpit state: NOT_CONNECTED</div>
          )}
        </section>

        {/* §36-W-2 · ─── B3 · ERROR + SUGGESTED FILE BUILD (recovery loop) ─── */}
        {cockpitState?.view.error_diagnosis && (
          <section style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fff8f8" }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: "#a00" }}>
              B3 · ERROR + SUGGESTED FILE BUILD
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 11 }}>
              <div>error_kind</div>
              <div><code>{cockpitState.view.error_diagnosis.error_kind}</code></div>
              <div>summary</div>
              <div>{cockpitState.view.error_diagnosis.error_summary}</div>
              <div>epistemic</div>
              <div><code>{cockpitState.view.error_diagnosis.epistemic_status}</code></div>
              <div>derived_from</div>
              <div><code>{cockpitState.view.error_diagnosis.derived_from.join(" · ")}</code></div>
            </div>
            {cockpitState.view.error_diagnosis.suggested_files.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Suggested files:</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11 }}>
                  {cockpitState.view.error_diagnosis.suggested_files.map((s, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      <code>{s.path}</code> · <span style={{ color: "#888" }}>{s.proposed_action}</span>
                      <div style={{ color: "#666", fontSize: 10 }}>reason: {s.reason}</div>
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 6, fontSize: 10, color: "#888", fontStyle: "italic" }}>
                  SUGGESTED ≠ AUTHORISED ≠ CHANGED ≠ VERIFIED (locked distinction · W2 recovery-flow).
                </div>
              </div>
            )}
          </section>
        )}

        {/* §36-W-2 · ─── B4 · FILE CHANGE LEDGER (real git · action + status) ─── */}
        <section style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fff" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>B4 · FILE CHANGE LEDGER</div>
          {cockpitState && cockpitState.view.file_change_ledger.length > 0 ? (
            <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f4f4f4" }}>
                  <th style={{ padding: "2px 4px", textAlign: "left" }}>PATH</th>
                  <th style={{ padding: "2px 4px", textAlign: "left" }}>ACTION</th>
                  <th style={{ padding: "2px 4px", textAlign: "left" }}>STATUS</th>
                  <th style={{ padding: "2px 4px", textAlign: "left" }}>ACTIVITY</th>
                </tr>
              </thead>
              <tbody>
                {cockpitState.view.file_change_ledger.slice(0, 24).map((e, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "2px 4px", fontFamily: "monospace" }}>{e.path}</td>
                    <td style={{ padding: "2px 4px" }}>
                      <code
                        style={{
                          padding: "1px 4px",
                          background:
                            e.action === "CREATED"
                              ? "#e6ffe6"
                              : e.action === "DELETED"
                              ? "#ffe6e6"
                              : "#eef",
                        }}
                      >
                        {e.action}
                      </code>
                    </td>
                    <td style={{ padding: "2px 4px" }}><code>{e.status}</code></td>
                    <td style={{ padding: "2px 4px", color: "#666" }}>{e.triggered_by_activity ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 11, color: "#888" }}>
              {cockpitState ? "no tracked changes in working tree" : "cockpit state NOT_CONNECTED"}
            </div>
          )}
          {cockpitState?.view.preview_causal_link && cockpitState.view.preview_causal_link.triggered_by_file && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#036" }}>
              PREVIEW_UPDATED · triggered by:{" "}
              <code>{cockpitState.view.preview_causal_link.triggered_by_file}</code>
              {cockpitState.view.preview_causal_link.triggered_by_activity && (
                <> · activity: <code>{cockpitState.view.preview_causal_link.triggered_by_activity}</code></>
              )}
            </div>
          )}
        </section>

        {/* ─── C · PLAN / WORK ORDER ────────────────────────────────────────── */}
        {trace && (
          <section style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fff" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>C · PLAN / WORK ORDER</div>
            {trace.work_order ? (
              <pre
                style={{
                  fontSize: 10,
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  maxHeight: 200,
                  overflow: "auto",
                  background: "#f8f8f8",
                  padding: 6,
                  border: "1px solid #eee",
                }}
              >
                {JSON.stringify(trace.work_order, null, 2)}
              </pre>
            ) : (
              <div style={{ fontSize: 11, color: "#888" }}>work order not yet composed</div>
            )}
          </section>
        )}

        {/* ─── D · PIPELINE STAGES ──────────────────────────────────────────── */}
        {trace && (
          <section style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fff" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>D · PIPELINE</div>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f4f4f4" }}>
                  <th style={{ textAlign: "left", padding: "2px 4px" }}>stage</th>
                  <th style={{ textAlign: "left", padding: "2px 4px" }}>status</th>
                  <th style={{ textAlign: "left", padding: "2px 4px" }}>evidence_ref</th>
                  <th style={{ textAlign: "left", padding: "2px 4px" }}>note</th>
                </tr>
              </thead>
              <tbody>
                {ORDER.map((s) => {
                  const r = trace.stage_statuses[s];
                  return (
                    <tr key={s} style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ padding: "2px 4px" }}>
                        <code>{s}</code>
                      </td>
                      <td style={{ padding: "2px 4px" }}>{statusGlyph(r?.status)}</td>
                      <td style={{ padding: "2px 4px" }}>
                        <code>{r?.evidence_ref ?? ""}</code>
                      </td>
                      <td style={{ padding: "2px 4px", color: "#888" }}>{r?.limitation_note ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* ─── E · CHANGE SURFACE (REAL git diff) ───────────────────────────── */}
        <section style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fff" }}>
          <div style={{ fontWeight: 600, marginBottom: 6, display: "flex", gap: 8, alignItems: "center" }}>
            <span>E · CHANGE SURFACE (real git status)</span>
            <span style={{ fontSize: 10, color: "#666" }}>
              refreshed: {changesCheckedAt ? changesCheckedAt.slice(11, 19) : "—"}
            </span>
          </div>
          {!changes ? (
            <div style={{ fontSize: 11, color: "#888" }}>loading…</div>
          ) : !changes.connected ? (
            <div style={{ fontSize: 11, color: "#a00" }}>
              CHANGES NOT_CONNECTED · {changes.reason ?? "unknown"}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, marginBottom: 4 }}>
                +{changes.added} added · ~{changes.modified} modified · -{changes.deleted} deleted · ?{" "}
                {changes.untracked} untracked
                {changes.stat_summary && (
                  <span style={{ color: "#666", marginLeft: 8 }}>[{changes.stat_summary}]</span>
                )}
              </div>
              {changes.changes.length === 0 ? (
                <div style={{ fontSize: 11, color: "#888" }}>working tree clean</div>
              ) : (
                <div
                  style={{
                    maxHeight: 200,
                    overflow: "auto",
                    fontSize: 10,
                    background: "#f8f8f8",
                    padding: 6,
                    border: "1px solid #eee",
                  }}
                >
                  {changes.changes.map((c, i) => (
                    <div key={`${c.path}-${i}`}>
                      <code>{c.status}</code> <code>{c.path}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ─── F · TESTS (NOT_CONNECTED · honest) ───────────────────────────── */}
        <section style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fff" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>F · TESTS</div>
          <div style={{ fontSize: 11, color: "#a00" }}>
            TESTS · NOT_CONNECTED (this cockpit does not currently execute tests · vitest
            runs are external · this pane will be wired in a subsequent wave under a bounded §36
            amendment)
          </div>
        </section>

        {/* ─── G · FOUNDER DECISION ─────────────────────────────────────────── */}
        {trace && (
          <section
            style={{
              padding: 12,
              borderBottom: "1px solid #eee",
              background: trace.current_state === "FOUNDER_DECISION" ? "#fff8dc" : "#fff",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>G · FOUNDER CONTROL</div>
            <div style={{ fontSize: 11, marginBottom: 6 }}>
              decision: <code>{trace.founder_decision ?? "(awaiting)"}</code>
            </div>
            {trace.current_state === "FOUNDER_DECISION" ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => decide("AUTHORISE")} disabled={busy} style={{ padding: "4px 12px" }}>
                  AUTHORISE
                </button>
                <button onClick={() => decide("REJECT")} disabled={busy} style={{ padding: "4px 12px" }}>
                  REJECT
                </button>
                <button onClick={() => decide("HOLD")} disabled={busy} style={{ padding: "4px 12px" }}>
                  HOLD
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#666" }}>
                controls only available in FOUNDER_DECISION state · current: <code>{trace.current_state}</code>
              </div>
            )}
          </section>
        )}

        {/* ─── H · AUDIT TRAIL (real events from trace) ─────────────────────── */}
        {trace && trace.audit_trail.length > 0 && (
          <section style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fff" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>H · AUDIT TRAIL (real trace events)</div>
            <div
              style={{
                maxHeight: 220,
                overflow: "auto",
                fontSize: 10,
                background: "#f8f8f8",
                padding: 6,
                border: "1px solid #eee",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>at</th>
                    <th style={{ textAlign: "left" }}>actor</th>
                    <th style={{ textAlign: "left" }}>action</th>
                    <th style={{ textAlign: "left" }}>detail</th>
                  </tr>
                </thead>
                <tbody>
                  {trace.audit_trail.map((e, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                      <td>
                        <code>{e.at.slice(11, 19)}</code>
                      </td>
                      <td>
                        <code>{e.actor}</code>
                      </td>
                      <td>
                        <code>{e.action}</code>
                      </td>
                      <td>{e.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ─── I · HONEST LIMITATIONS ───────────────────────────────────────── */}
        <section
          style={{
            padding: 12,
            background: "#fff4e0",
            borderTop: "1px solid #eec",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>I · HONEST LIMITATIONS (v0.1.0)</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.5 }}>
            <li>
              <strong>Preview:</strong> real iframe · real HTTP reachability probe · auto-refresh
              on git-change detection. Fast Refresh works when the Next.js dev server is running.
            </li>
            <li>
              <strong>Change surface:</strong> real <code>git status --porcelain</code> +{" "}
              <code>git diff --stat</code>. Refreshes every 5s. No fabrication.
            </li>
            <li>
              <strong>Orchestrator state:</strong> real SSE stream against the actual in-memory
              trace store. Emits only on material state change.
            </li>
            <li>
              <strong>NOT_CONNECTED · Tests:</strong> this cockpit does not execute tests. Test
              execution requires a subsequent bounded §36 amendment. Never shows fabricated PASS.
            </li>
            <li>
              <strong>NOT_CONNECTED · Automatic NEX1 execution:</strong> EXECUTION / VERIFICATION
              / RELEASE stages in the orchestrator are declared LIMITED_V0/NOT_IMPLEMENTED by the
              existing pipeline. The cockpit surfaces those states truthfully; it does not
              synthesise progress.
            </li>
            <li>
              <strong>NOT_CONNECTED · Live NEX1 authoring:</strong> Perpetual Coder Rule stands.
              NEX1's authoring pathway (typed_data_contract · test-scaffold-authoring · etc.) is
              not yet wired into this cockpit's mission flow. Wire-up requires a bounded §36
              amendment.
            </li>
          </ul>
        </section>
      </section>
    </div>
    </>
  );
}
