"use client";

// src/app/nexapp/nex-agent/NexAgentWorkstation.tsx
//
// NEX1 Programming Workstation · split-workspace.
//
// LEFT:   real live app-sized preview iframe · viewport picker · scale-to-fit
//         (no scrollbars on the wrapper · full app height + width always visible).
// RIGHT:  HISTORY / CODE tab toggle · then panel (cards OR live feed) · prompt bar.
// HEADER: GitHub repo connect · autonomy tier · stream status.
//
// Wiring:
//   POST /api/nex/agent/submit                 — new prompt
//   GET  /api/nex/agent/stream                 — task index
//   GET  /api/nex/agent/stream?task_id&sse=1   — SSE feed
//   POST /api/nex/agent/erase                  — erase card · drop branch · wipe live/preview
//   GET  /api/nex/agent/github                 — read connection
//   POST /api/nex/agent/github                 — connect a repo
//
// Discipline: NEX1 codes · Master AI Engineer + Claude review.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  extractDecision,
  extractExplicitCodeBlocks,
  splitTextAndCode,
  compactBodySummary,
  type StepCodeBlock,
} from "@/lib/nex-agent/step-renderer";
import { TurbopackWatchdog } from "./TurbopackWatchdog";
import { CommandPalette } from "./CommandPalette";
// ActorRibbon removed 2026-09-17 · founder request · noise, no signal.
// The "Thinking…" state now lives inline in the Code panel · beside the
// step being written · not in a separate horizontal bar.
import { ConstitutionalTicker } from "./ConstitutionalTicker";
import { SeoAgentPanel } from "./SeoAgentPanel";
import { ScreensDock } from "./ScreensDock";
import { MobileControlsPanel } from "./MobileControlsPanel";
import { Nex1Brand } from "./Nex1Brand";
import { LearningPanel } from "./LearningPanel";
// 2026-09-16 · Nex1CapabilityLadder removed from workstation UI per Founder request.
// import { Nex1CapabilityLadder } from "./Nex1CapabilityLadder";
import { SketchOverlay } from "./SketchOverlay";
import { VoiceOverlay } from "./VoiceOverlay";
import { VoiceRecorderOverlay } from "./VoiceRecorderOverlay";
import { useErrorGuardian } from "./ErrorGuardian";
import { PluginsPanel } from "./PluginsPanel";
import { NativeLoopPanel } from "./NativeLoopPanel";
import { RepoOnboardPanel } from "./RepoOnboardPanel";
import { NotesPanel } from "./NotesPanel";
import { GitHubConnectButton, ProviderConnectButton, HqBackButton } from "./HeaderConnectButtons";
import { WorkstationOrb } from "./WorkstationOrb";
import { providerById } from "@/lib/nex-agent/provider-catalog";
import {
  PHONE_MODELS,
  BEZEL_COLORS,
  DEFAULT_MODEL_ID,
  DEFAULT_BEZEL_COLOR_ID,
  groupedModels,
  modelById,
  bezelColorById,
  customBezelColor,
  type PhoneModel,
  type CutoutSpec,
} from "@/lib/nex-agent/phone-models";
import { dayLabel, isStale } from "@/lib/nex-agent/day-labels";
import { suggestFormats, detectHumanReadableFormat, type FormatOption } from "@/lib/nex-agent/format-suggestions";

interface Task {
  task_id: string; submitted_at: string; updated_at: string; submitted_by: string;
  prompt: string; status: string; current_actor: string | null;
  plan?: unknown; brief?: string | null;
}
interface Step {
  step_id: string; task_id: string; created_at: string;
  actor: "nex1" | "nex2" | "nex3" | "founder" | "system";
  step_kind: string; title: string; body: unknown;
}
interface GhConnection {
  repoUrl: string;
  owner: string;
  repo: string;
  connectedAt: string;
  connectedBy: string;
  reachable: boolean | null;
  reachabilityCheckedAt: string | null;
}
interface UploadedAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isImage: boolean;
  isText: boolean;
  previewUrl: string;
  uploadedAt: string;
  /** Format choice made by the founder · null until picked. */
  formatChoiceId: string | null;
  formatChoiceLabel: string | null;
}
interface QueueEntry {
  id: string;
  prompt: string;
  queuedAt: string;
  queuedBy: string;
  attachments: Array<{ id: string; filename: string; mimeType: string; size: number; isImage: boolean; previewUrl: string }>;
  classification: { decision: string; confidence: number; reasoning: string } | null;
}

type Viewport = "mobile" | "tablet" | "desktop" | "fluid";
type TabView = "history" | "code" | "plugins" | "native-loop" | "repo" | "notes";

const VIEWPORTS: Record<Viewport, { w: number; h: number; label: string; fluid?: boolean }> = {
  mobile:  { w: 390,   h: 844,   label: "iPhone 390×844" },
  tablet:  { w: 820,   h: 1180,  label: "Tablet 820×1180" },
  desktop: { w: 1440,  h: 900,   label: "Desktop 1440×900" },
  fluid:   { w: 0,     h: 0,     label: "Fluid", fluid: true },
};

const ACTOR_LABELS: Record<Step["actor"], string> = {
  nex1: "NEX1 · Coder",
  nex2: "Engineer · Check",
  nex3: "Claude · Check",
  founder: "Founder",
  system: "System",
};

const ACTOR_INITIALS: Record<Step["actor"], string> = {
  nex1: "N1",
  nex2: "N2",
  nex3: "N3",
  founder: "F",
  system: "S",
};

function formatDurationSeconds(fromISO: string, toISO: string): string {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return "—";
  const diff = Math.max(0, Math.floor((to - from) / 1000));
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}m ${s}s`;
}

const STATUS_TONE: Record<string, string> = {
  submitted: "naw-badge-slate", clarifying: "naw-badge-amber", planning: "naw-badge-cyan",
  plan_ready: "naw-badge-green", plan_rejected: "naw-badge-red", plan_approved: "naw-badge-cyan",
  applying: "naw-badge-cyan", applied_verified: "naw-badge-green", applied_needs_review: "naw-badge-amber",
  migration_applied: "naw-badge-green", migration_failed: "naw-badge-red",
  shipped: "naw-badge-green", archived: "naw-badge-slate", erased: "naw-badge-red",
};

// Kinds that indicate NEX1 is actively coding right now (auto-switch to Code tab)
const ACTIVELY_CODING_STATUSES = new Set(["planning", "applying", "clarifying"]);

// Internal pipeline telemetry step_kinds · hidden from the founder-facing Code
// feed. These carry raw JSON metadata (Layer-2 pattern hits, dispatch routing,
// intent classification internals) that is useful for diagnostics but noise in
// a chat surface. Founder rule 2026-09-17: chat is a chat · not a debug log.
const INTERNAL_STEP_KINDS = new Set([
  "thought",              // Layer-2 pattern hits · intent classification internals
  "dispatch",             // routing telemetry
  "route",                // routing telemetry
  "trace",                // pipeline trace
  "debug",                // any debug-only kind
  "orchestrator_status",  // multi-round discussion progress (starting/round/consensus/halt)
]);
// In-flight states = active task exists AND queue-classifier should route through /queue
const IN_FLIGHT_STATUSES = new Set(["submitted", "clarifying", "planning", "applying", "plan_ready", "plan_approved"]);
// Terminal states that trigger auto-promotion of the next queued prompt
const AUTO_PROMOTE_STATUSES = new Set(["applied_verified", "applied_needs_review", "plan_rejected", "shipped", "archived", "erased", "paused"]);

// URL detection · finds http(s) URLs anywhere in a prompt
const URL_RE = /https?:\/\/[^\s<>"'\]}]+[^\s.,;!?<>"'\]}]/gi;

/**
 * Derive a preview URL from a task's plan · looks for src/app/{route}/page.tsx.
 * Falls back to /nexapp if no page file is referenced.
 */
function derivePreviewUrl(task: Task): string {
  const plan = task.plan as { proposed_files?: Array<{ path?: string }>; files_to_touch?: string[] } | null | undefined;
  const paths: string[] = [];
  if (plan?.proposed_files) for (const pf of plan.proposed_files) if (pf?.path) paths.push(String(pf.path));
  if (plan?.files_to_touch) for (const p of plan.files_to_touch) paths.push(String(p));
  for (const p of paths) {
    const m = /^src\/app\/(.+?)\/page\.tsx?$/.exec(p);
    if (!m) continue;
    const segments = m[1].split("/").filter((s) => !(s.startsWith("(") && s.endsWith(")"))); // strip route groups
    const route = "/" + segments.join("/");
    return route.replace(/\[([^\]]+)\]/g, ":$1"); // dynamic segments · founder-visible placeholder
  }
  return "/nexapp";
}

export function NexAgentWorkstation() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<"idle" | "live" | "closed" | "error">("idle");
  // Founder rule 2026-09-17: Code is the first tile and the default active
  // tab on arrival. History / Plugins / Loop / Repo are all secondary. The
  // Code tile stays visually selected until the founder clicks another tile.
  const [tab, setTab] = useState<TabView>("code");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [previewUrl, setPreviewUrl] = useState<string>("about:blank");
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  // Active Project · canonical NEX Project identity (Phase 6 · 2026-09-19).
  // The Workstation reads (never writes) an active_project_id from
  // localStorage and asks the resolver for the 4-state outcome.
  // Rule 6 · null id → NOT_AVAILABLE · no silent selection.
  const [activeProjectId, _setActiveProjectId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const v = localStorage.getItem("naw:activeProjectId");
      return v && v.length > 0 ? v : null;
    } catch { return null; }
  });
  const [activeProjectState, setActiveProjectState] = useState<
    | { status: "RESOLVED"; project_name: string; project_slug: string; workspace_root: string }
    | { status: "AMBIGUOUS"; count: number }
    | { status: "NOT_AVAILABLE"; reason: string }
    | { status: "INVALID"; reason: string }
    | null
  >(null);
  useEffect(() => {
    let cancelled = false;
    const url = activeProjectId
      ? `/api/nex1/workstation/active-project?active_project_id=${encodeURIComponent(activeProjectId)}`
      : `/api/nex1/workstation/active-project`;
    (async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        if (cancelled) return;
        if (j.status === "RESOLVED") {
          setActiveProjectState({
            status: "RESOLVED",
            project_name: j.project.project_name,
            project_slug: j.project.project_slug,
            workspace_root: j.project.workspace_root,
          });
        } else if (j.status === "AMBIGUOUS") {
          setActiveProjectState({ status: "AMBIGUOUS", count: (j.candidates ?? []).length });
        } else if (j.status === "INVALID") {
          setActiveProjectState({ status: "INVALID", reason: String(j.reason ?? "") });
        } else {
          setActiveProjectState({ status: "NOT_AVAILABLE", reason: String(j.reason ?? "no project") });
        }
      } catch (e) {
        if (!cancelled) setActiveProjectState({ status: "NOT_AVAILABLE", reason: e instanceof Error ? e.message : "fetch_failed" });
      }
    })();
    return () => { cancelled = true; };
  }, [activeProjectId]);

  // Save · Workstation-level Save opens the honest project-state envelope.
  // Save does NOT silently commit, push, or publish. It calls the read-only
  // inspect endpoint which composes assessProjectState + buildSavePushEnvelope.
  const [saveInspecting, setSaveInspecting] = useState<boolean>(false);
  const [saveEnvelope, setSaveEnvelope] = useState<null | {
    ok: boolean;
    refused?: "NOT_AVAILABLE" | "AMBIGUOUS" | "INVALID" | "SERVER_ERROR";
    project_name?: string;
    project_slug?: string;
    workspace_root?: string;
    close_flow_state?: string;
    plain_language_message?: string;
    allowed_actions?: readonly string[];
    show_warning?: boolean;
    remote_save_verified?: boolean;
    remote_save_verified_reason?: string;
    counts?: { modified: number; untracked: number; staged: number; deleted: number };
    branch?: string | null;
    input_digest?: string;
    evidence_receipt_path?: string | null;
    reason?: string | null;
  }>(null);
  const runSaveInspect = async () => {
    setSaveInspecting(true);
    try {
      const resp = await fetch("/api/nex1/save/inspect", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active_project_id: activeProjectId }),
      });
      const j = await resp.json();
      if (j.ok) {
        setSaveEnvelope({
          ok: true,
          project_name: j.project?.project_name,
          project_slug: j.project?.project_slug,
          workspace_root: j.project?.workspace_root,
          close_flow_state: j.envelope?.close_flow_state,
          plain_language_message: j.envelope?.plain_language_message,
          allowed_actions: j.envelope?.allowed_actions,
          show_warning: j.envelope?.show_warning,
          remote_save_verified: j.envelope?.remote_save_verified,
          remote_save_verified_reason: j.envelope?.remote_save_verified_reason,
          counts: j.assessment?.counts,
          branch: j.assessment?.refs?.branch ?? null,
          input_digest: j.envelope?.input_digest,
          evidence_receipt_path: j.evidence_receipt_path,
          reason: null,
        });
      } else {
        setSaveEnvelope({
          ok: false,
          refused: j.refused,
          reason: j.reason ?? "unknown",
        });
      }
    } catch (e) {
      setSaveEnvelope({
        ok: false,
        refused: "SERVER_ERROR",
        reason: e instanceof Error ? e.message : "fetch_failed",
      });
    } finally {
      setSaveInspecting(false);
    }
  };

  // GitHub connection
  const [gh, setGh] = useState<GhConnection | null>(null);
  const [ghInput, setGhInput] = useState("");
  const [ghBusy, setGhBusy] = useState(false);
  const [ghMsg, setGhMsg] = useState<string | null>(null);

  // Attachments · pending (not yet sent with a prompt)
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [stopping, setStopping] = useState(false);

  // Queue (up to 10 · shown at bottom of Code panel)
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [toast, setToast] = useState<{ kind: "merged" | "queued"; title: string; body: string } | null>(null);
  const promotingRef = useRef<boolean>(false);

  // Founder decisions · per-step tracking of which option was chosen
  const [decidedSteps, setDecidedSteps] = useState<Record<string, { optionId: string; label: string }>>({});
  // C11 UI chip · per-task uncertainty envelopes returned by /api/nex/agent/submit.
  // Keyed by task_id · shows verdict + confidence in the Code feed header. Never
  // populated for older tasks (submit wasn't returning envelopes before) · panel
  // just renders nothing in that case.
  const [taskEnvelopes, setTaskEnvelopes] = useState<Record<string, {
    verdict: string; confidence: number; reason: string;
    options?: Array<{ id: string; label: string }>;
    next_action_hint?: string | null;
    missing_evidence?: Array<{ kind: string; description: string }>;
    provenance?: Array<{ kind: string; value: string }>;
    source?: string;
    zero_llm?: boolean;
  }>>({});
  // Chip click-to-expand · task_id of the envelope currently being inspected.
  const [inspectingEnvelope, setInspectingEnvelope] = useState<string | null>(null);
  // Ephemeral "Copied ✓" feedback after the modal's Copy JSON button.
  const [envelopeCopied, setEnvelopeCopied] = useState<boolean>(false);
  // C10 Phase 3 · stable session_id per browser tab. Persists in localStorage
  // so every task submitted in this tab shares one conversation graph. Every
  // fetch to /api/nex/agent/submit includes it · orchestrator uses it as the
  // graph key instead of task_id. Preferences captured in task 1 are visible
  // when the founder starts task 2.
  const [sessionId] = useState<string>(() => {
    if (typeof window === "undefined") return `s-${Date.now()}`;
    try {
      const KEY = "nex1_session_id";
      const existing = window.localStorage.getItem(KEY);
      if (existing) return existing;
      const fresh = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem(KEY, fresh);
      return fresh;
    } catch { return `s-${Date.now()}`; }
  });
  // C7 phase 2 · click-picked ambiguity options · keyed by step_id.
  // Once a letter is picked, all buttons for that step disable and we
  // POST the letter as a continuation of the active task (same wire the
  // orchestrator already uses when the founder types "A" manually).
  const [ambiguityPicks, setAmbiguityPicks] = useState<Record<string, string>>({});

  // LEFT panel mode · "preview" (iframe) or "editor" (code editor for a card's files)
  const [leftMode, setLeftMode] = useState<"preview" | "editor">("preview");
  const [editorTaskId, setEditorTaskId] = useState<string | null>(null);

  // Prompt textarea auto-grow (5x max)
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const PROMPT_MIN_H = 60;
  const PROMPT_MAX_H = 300; // ~5x the standard 60px height

  // Zoom (LEFT preview only) · persisted per viewport in localStorage
  const [zoom, setZoom] = useState<number>(1);

  // Mobile phone model + custom-size + bezel visibility + bezel color
  const [phoneModelId, setPhoneModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [customMobile, setCustomMobile] = useState<{ w: number; h: number }>({ w: 390, h: 844 });
  const [showBezel, setShowBezel] = useState<boolean>(true);
  const [bezelColorId, setBezelColorId] = useState<string>(DEFAULT_BEZEL_COLOR_ID);
  const [showCutoutOutline, setShowCutoutOutline] = useState<boolean>(true);

  // Custom bezel colour · picked via HTML color input · overrides bezelColorId when set
  const [customBezelHex, setCustomBezelHex] = useState<string>("#0B1220");
  const [useCustomBezel, setUseCustomBezel] = useState<boolean>(false);

  // Command palette + zen mode + ambient sound
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [fullscreenPreview, setFullscreenPreview] = useState<boolean>(false);
  const [ambientSound, setAmbientSound] = useState<boolean>(false);

  // Last provider the founder picked from the Backend dropdown · persisted
  const [lastProviderId, setLastProviderId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("naw:lastProviderId");
      if (saved && providerById(saved)) setLastProviderId(saved);
    } catch { /* */ }
  }, []);
  useEffect(() => {
    if (!lastProviderId) return;
    try { localStorage.setItem("naw:lastProviderId", lastProviderId); } catch { /* */ }
  }, [lastProviderId]);

  // Sketch + Voice + Voice-over recorder modes
  const [sketchMode, setSketchMode] = useState<boolean>(false);
  const [voiceMode, setVoiceMode] = useState<boolean>(false);
  const [voiceRecorderMode, setVoiceRecorderMode] = useState<boolean>(false);
  const [sketchAttachedUrl, setSketchAttachedUrl] = useState<string | null>(null);

  const feedRef = useRef<HTMLDivElement | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [wrapSize, setWrapSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const loadTasks = useCallback(async () => {
    try {
      const r = await fetch("/api/nex/agent/stream", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setTasks(j.tasks);
    } catch { /* transient */ }
  }, []);

  const loadGh = useCallback(async () => {
    try {
      const r = await fetch("/api/nex/agent/github", { cache: "no-store" });
      const j = await r.json();
      if (j.ok && j.connection?.repoUrl) setGh(j.connection);
      else setGh(null);
    } catch { /* transient */ }
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const r = await fetch("/api/nex/agent/queue", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) setQueue(j.queue ?? []);
    } catch { /* transient */ }
  }, []);

  const runHistoryCleanup = useCallback(async (triggeredBy: "auto" | "github_connect" | "founder") => {
    try {
      await fetch("/api/nex/agent/history/cleanup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threshold_days: 7, triggered_by: triggeredBy }),
      });
    } catch { /* transient · never let cleanup crash the UI */ }
  }, []);

  useEffect(() => {
    void loadTasks();
    void loadGh();
    void loadQueue();
    // Fire-and-forget auto-purge of tasks older than 7 days on mount
    void runHistoryCleanup("auto");
    const iv = setInterval(() => { void loadTasks(); void loadQueue(); }, 5000);
    return () => clearInterval(iv);
  }, [loadTasks, loadGh, loadQueue, runHistoryCleanup]);

  // Measure preview wrapper for scale-to-fit
  useEffect(() => {
    if (!previewWrapRef.current) return;
    const el = previewWrapRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const e of entries) {
        setWrapSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    observer.observe(el);
    setWrapSize({ w: el.clientWidth, h: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  // Persist viewport + zoom + phone-model + bezel settings · restored on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedViewport = localStorage.getItem("naw:viewport") as Viewport | null;
      if (savedViewport && VIEWPORTS[savedViewport]) setViewport(savedViewport);
      const savedZoom = localStorage.getItem("naw:zoom");
      if (savedZoom) {
        const n = Number(savedZoom);
        if (Number.isFinite(n) && n >= 0.25 && n <= 3) setZoom(n);
      }
      const savedModel = localStorage.getItem("naw:phoneModelId");
      if (savedModel && (savedModel === "custom" || PHONE_MODELS.some((m) => m.id === savedModel))) setPhoneModelId(savedModel);
      const savedCustomW = localStorage.getItem("naw:customW");
      const savedCustomH = localStorage.getItem("naw:customH");
      if (savedCustomW && savedCustomH) {
        const w = Number(savedCustomW), h = Number(savedCustomH);
        if (Number.isFinite(w) && Number.isFinite(h) && w >= 100 && h >= 100 && w <= 2000 && h <= 4000) {
          setCustomMobile({ w, h });
        }
      }
      const savedBezel = localStorage.getItem("naw:showBezel");
      if (savedBezel !== null) setShowBezel(savedBezel === "1");
      const savedColor = localStorage.getItem("naw:bezelColorId");
      if (savedColor && BEZEL_COLORS.some((c) => c.id === savedColor)) setBezelColorId(savedColor);
      const savedOutline = localStorage.getItem("naw:showCutout");
      if (savedOutline !== null) setShowCutoutOutline(savedOutline === "1");
      const savedCustomHex = localStorage.getItem("naw:customBezelHex");
      if (savedCustomHex && /^#[0-9a-fA-F]{6}$/.test(savedCustomHex)) setCustomBezelHex(savedCustomHex);
      const savedUseCustom = localStorage.getItem("naw:useCustomBezel");
      if (savedUseCustom !== null) setUseCustomBezel(savedUseCustom === "1");
      const savedZen = localStorage.getItem("naw:zenMode");
      if (savedZen !== null) setZenMode(savedZen === "1");
      const savedSound = localStorage.getItem("naw:ambientSound");
      if (savedSound !== null) setAmbientSound(savedSound === "1");
    } catch { /* localStorage unavailable · ignore */ }
  }, []);
  useEffect(() => { try { localStorage.setItem("naw:viewport", viewport); } catch { /* */ } }, [viewport]);
  useEffect(() => { try { localStorage.setItem("naw:zoom", String(zoom)); } catch { /* */ } }, [zoom]);
  useEffect(() => { try { localStorage.setItem("naw:phoneModelId", phoneModelId); } catch { /* */ } }, [phoneModelId]);
  useEffect(() => {
    try {
      localStorage.setItem("naw:customW", String(customMobile.w));
      localStorage.setItem("naw:customH", String(customMobile.h));
    } catch { /* */ }
  }, [customMobile.w, customMobile.h]);
  useEffect(() => { try { localStorage.setItem("naw:showBezel", showBezel ? "1" : "0"); } catch { /* */ } }, [showBezel]);
  useEffect(() => { try { localStorage.setItem("naw:bezelColorId", bezelColorId); } catch { /* */ } }, [bezelColorId]);
  useEffect(() => { try { localStorage.setItem("naw:showCutout", showCutoutOutline ? "1" : "0"); } catch { /* */ } }, [showCutoutOutline]);
  useEffect(() => { try { localStorage.setItem("naw:customBezelHex", customBezelHex); } catch { /* */ } }, [customBezelHex]);
  useEffect(() => { try { localStorage.setItem("naw:useCustomBezel", useCustomBezel ? "1" : "0"); } catch { /* */ } }, [useCustomBezel]);
  useEffect(() => { try { localStorage.setItem("naw:zenMode", zenMode ? "1" : "0"); } catch { /* */ } }, [zenMode]);
  useEffect(() => { try { localStorage.setItem("naw:ambientSound", ambientSound ? "1" : "0"); } catch { /* */ } }, [ambientSound]);

  // ⌘K / Ctrl-K opens the command palette globally
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        setPaletteOpen((v) => !v);
        e.preventDefault();
      }
      // Sketch (S) + Voice (V) shortcuts when NOT typing in an input
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select";
      if (!isTyping) {
        if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey) {
          setSketchMode((v) => !v);
          setVoiceMode(false);
          e.preventDefault();
        }
        if (e.key.toLowerCase() === "v" && !e.metaKey && !e.ctrlKey) {
          setVoiceMode((v) => !v);
          setSketchMode(false);
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // SSE for active task
  useEffect(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    if (!activeId) { setActiveTask(null); setSteps([]); setStreamState("idle"); return; }
    setSteps([]);
    setStreamState("live");
    const es = new EventSource(`/api/nex/agent/stream?task_id=${activeId}&sse=1`);
    esRef.current = es;
    es.addEventListener("task", (ev) => {
      try { setActiveTask(JSON.parse((ev as MessageEvent).data)); } catch { /* skip */ }
    });
    es.addEventListener("step", (ev) => {
      try {
        const s = JSON.parse((ev as MessageEvent).data) as Step;
        setSteps((prev) => (prev.some((x) => x.step_id === s.step_id) ? prev : [...prev, s]));
      } catch { /* skip */ }
    });
    es.addEventListener("close", () => { setStreamState("closed"); es.close(); });
    es.onerror = () => { setStreamState("error"); };
    return () => { es.close(); esRef.current = null; };
  }, [activeId]);

  // Auto-switch to Code tab when NEX1 starts coding · auto-reload preview when code lands
  useEffect(() => {
    if (!activeTask) return;
    if (ACTIVELY_CODING_STATUSES.has(activeTask.status)) setTab("code");
  }, [activeTask?.status]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Learning ledger auto-writer · records success on applied_verified · failure
  // on plan_rejected · anti-pattern on applied_needs_review. Uses each task's
  // plan.proposed_files to derive skills.
  const recordedTaskStatuses = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!activeTask) return;
    const prev = recordedTaskStatuses.current.get(activeTask.task_id);
    if (prev === activeTask.status) return;
    recordedTaskStatuses.current.set(activeTask.task_id, activeTask.status);
    const plan = activeTask.plan as { proposed_files?: Array<{ path?: string }> } | null | undefined;
    const filePaths = plan?.proposed_files?.map((f) => String(f?.path ?? "")).filter(Boolean) ?? [];
    if (activeTask.status === "applied_verified") {
      void fetch("/api/nex/agent/learning/record", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "success", taskId: activeTask.task_id, filePaths }),
      }).catch(() => { /* transient */ });
      void fetch("/api/nex/agent/learning/record", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "pattern", taskId: activeTask.task_id, filePaths,
          title: activeTask.prompt.slice(0, 80),
        }),
      }).catch(() => { /* transient */ });
    } else if (activeTask.status === "plan_rejected" || activeTask.status === "applied_needs_review") {
      void fetch("/api/nex/agent/learning/record", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: activeTask.status === "plan_rejected" ? "antipattern" : "failure",
          taskId: activeTask.task_id, filePaths,
          title: activeTask.prompt.slice(0, 80),
          rejectionCode: activeTask.status === "plan_rejected" ? "plan_rejected" : "applied_needs_review",
        }),
      }).catch(() => { /* transient */ });
    }
  }, [activeTask?.task_id, activeTask?.status]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (steps.length === 0) return;
    const last = steps[steps.length - 1];
    if (last.actor === "nex1" && (last.step_kind === "file_written" || last.step_kind === "applied")) {
      setReloadNonce((n) => n + 1);
    }
  }, [steps]);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [steps, tab]);

  const submit = async () => {
    if (!prompt.trim() && attachments.length === 0) return;
    if (submitting) return;
    setSubmitting(true); setErr(null);
    try {
      // Scrape any URLs in the prompt · results become paraphrase-only source
      // material appended to the prompt. NEX1 must REWORD · never copy verbatim.
      const urls = Array.from(new Set((prompt.match(URL_RE) ?? []).slice(0, 3)));
      let scrapedBlocks: string[] = [];
      for (const u of urls) {
        try {
          const sr = await fetch("/api/nex/agent/scrape", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url: u }),
          });
          const sj = await sr.json();
          if (sj.ok) {
            scrapedBlocks.push(
              `--- SOURCE MATERIAL (PARAPHRASE ONLY · NEVER COPY VERBATIM) ---\n` +
              `URL: ${sj.source_url}\n` +
              `Host: ${sj.host}\n` +
              (sj.title ? `Title: ${sj.title}\n` : ``) +
              `System hint: ${sj.system_hint}\n\n` +
              `Content (${sj.chars} chars, cleaned):\n${sj.text}\n` +
              `--- END SOURCE ---`,
            );
          } else {
            scrapedBlocks.push(`--- SCRAPE FAILED for ${u}: ${sj.error ?? "unknown"} ---`);
          }
        } catch (e) {
          scrapedBlocks.push(`--- SCRAPE ERROR for ${u}: ${e instanceof Error ? e.message : "unknown"} ---`);
        }
      }
      const promptWithScrapeBase = scrapedBlocks.length > 0
        ? `${prompt}\n\n${scrapedBlocks.join("\n\n")}`
        : prompt;
      // formatHintBlock is added AFTER the attachmentsPayload block below,
      // so it appears after attachments in the composed prompt.
      let promptWithScrape = promptWithScrapeBase;

      // Founder rule 2026-09-17: queue only accepts when NEX1 is ACTIVELY
      // CODING (planning / applying). Every other state — idle, plan_ready
      // (awaiting founder approval), clarifying (waiting for reply) —
      // starts a NEW task instead of queueing. The queue is for "next code
      // file after the current one lands".
      const inFlight = activeTask
        && ACTIVELY_CODING_STATUSES.has(activeTask.status)
        && activeTask.status !== "clarifying";
      const attachmentsPayload = attachments.map((a) => ({
        id: a.id, filename: a.filename, mimeType: a.mimeType, size: a.size,
        isImage: a.isImage, previewUrl: a.previewUrl,
        formatChoiceId: a.formatChoiceId, formatChoiceLabel: a.formatChoiceLabel,
      }));

      // Compose the format-decision hint block · every attachment's founder
      // format choice is stated so NEX1 knows to keep · convert · or discuss.
      const formatHintBlock = attachments.length === 0 ? "" : (() => {
        const lines: string[] = [`--- FILE FORMAT DECISIONS (founder choice per attachment) ---`];
        for (const a of attachments) {
          const orig = detectHumanReadableFormat(a.filename, a.mimeType);
          const choice = a.formatChoiceLabel ?? "no choice yet · ask the founder";
          lines.push(`  · ${a.filename} · original: ${orig} · founder wants: ${choice}`);
        }
        lines.push(`--- END FORMAT DECISIONS ---`);
        return "\n\n" + lines.join("\n");
      })();

      const resetTextarea = () => {
        if (promptTextareaRef.current) promptTextareaRef.current.style.height = `${PROMPT_MIN_H}px`;
      };

      if (inFlight && activeTask) {
        const r = await fetch("/api/nex/agent/queue", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prompt: promptWithScrape,
            active_task_id: activeTask.task_id,
            attachments: attachmentsPayload,
            queued_by: "founder",
          }),
        });
        const j = await r.json();
        if (!j.ok) { setErr(j.error || "queue submit failed"); return; }
        if (j.action === "merged") {
          setToast({
            kind: "merged",
            title: "Merged into active task",
            body: `${j.classification?.reasoning ?? "added as founder addendum"}`,
          });
        } else if (j.action === "queued") {
          setToast({
            kind: "queued",
            title: `Queued · position ${j.queue_position}/10`,
            body: `${j.classification?.reasoning ?? "queued for after the active task"}`,
          });
        }
        setPrompt(""); setAttachments([]); resetTextarea();
        void loadQueue();
        setTimeout(() => setToast(null), 5000);
        return;
      }

      // No active task · submit directly as a new task
      let composedPrompt = promptWithScrape;
      if (attachments.length > 0) {
        const attachLines = attachments.map((a) =>
          `[${a.isImage ? "IMAGE" : a.isText ? "TEXT" : "FILE"}: ${a.filename} · ${a.mimeType} · ${(a.size / 1024).toFixed(1)} KB · id=${a.id} · url=${a.previewUrl}]`,
        );
        composedPrompt = `${composedPrompt}\n\n${attachLines.join("\n")}${formatHintBlock}`.trim();
      }
      const body: Record<string, unknown> = {
        prompt: composedPrompt,
        attachments: attachmentsPayload,
        session_id: sessionId,
      };
      if (activeTask?.status === "clarifying") body.continue_task_id = activeTask.task_id;
      // Bind customer task to canonical Project when one is resolved.
      // If activeProjectId is null the submit is treated as legacy/infrastructure
      // by the server · no binding is written · existing behaviour preserved.
      if (activeProjectId && activeProjectState?.status === "RESOLVED") {
        body.active_project_id = activeProjectId;
      }
      const r = await fetch("/api/nex/agent/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.ok) {
        setActiveId(j.task_id); setPrompt(""); setAttachments([]); resetTextarea(); setTab("code"); void loadTasks();
        // C11 UI chip · capture the envelope keyed by task_id
        if (j.uncertainty && j.task_id) {
          setTaskEnvelopes((prev) => ({ ...prev, [j.task_id]: j.uncertainty }));
        }
      }
      else {
        // Surface project-resolution refusals honestly · these are HTTP 409
        if (j.refused === "NOT_AVAILABLE") setErr("Task refused · no active project selected");
        else if (j.refused === "AMBIGUOUS") setErr(`Task refused · ${j.candidates?.length ?? 0} projects match · choose one`);
        else if (j.refused === "INVALID") setErr("Task refused · project workspace is unavailable");
        else setErr(j.error || "submit failed");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "err");
    } finally { setSubmitting(false); }
  };

  const removeFromQueue = async (id: string) => {
    try {
      await fetch(`/api/nex/agent/queue?id=${id}`, { method: "DELETE" });
      setQueue((prev) => prev.filter((q) => q.id !== id));
    } catch { /* transient */ }
  };

  const submitDecision = async (stepId: string, taskId: string, optionId: string, optionLabel: string) => {
    // Optimistic · lock the decision buttons immediately
    setDecidedSteps((prev) => ({ ...prev, [stepId]: { optionId, label: optionLabel } }));
    try {
      const r = await fetch("/api/nex/agent/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task_id: taskId, step_id: stepId, option_id: optionId, option_label: optionLabel, decided_by: "founder" }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(`decision failed: ${j.error ?? "unknown"}`);
        setDecidedSteps((prev) => { const n = { ...prev }; delete n[stepId]; return n; });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "decision failed");
      setDecidedSteps((prev) => { const n = { ...prev }; delete n[stepId]; return n; });
    }
  };

  // C7 phase 2 · founder-authorised 2026-09-17.
  // When the founder CLICKS an option letter on an ambiguity_clarification
  // handoff, we POST the letter as a normal continuation of the active
  // task. The C7 hook in the orchestrator recognises the letter, resolves
  // the ambiguity, and re-runs the pipeline with the forced intent. This
  // gives us click-to-pick UX with zero orchestrator changes · pure UI.
  const handleAmbiguityPick = async (stepId: string, letter: string, taskId: string) => {
    // Optimistic lock · disable all option buttons for this step.
    setAmbiguityPicks((prev) => ({ ...prev, [stepId]: letter }));
    try {
      const r = await fetch("/api/nex/agent/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: letter, continue_task_id: taskId, submitted_by: "founder", session_id: sessionId }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(`ambiguity pick failed: ${j.error ?? "unknown"}`);
        setAmbiguityPicks((prev) => { const n = { ...prev }; delete n[stepId]; return n; });
        return;
      }
      // C11 UI chip · capture the new envelope from the resolved-clarification submit.
      if (j.uncertainty && j.task_id) {
        setTaskEnvelopes((prev) => ({ ...prev, [j.task_id]: j.uncertainty }));
      }
      // Keep the same activeTask · new steps stream in via the existing SSE.
      void loadTasks();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ambiguity pick failed");
      setAmbiguityPicks((prev) => { const n = { ...prev }; delete n[stepId]; return n; });
    }
  };

  const promoteNextQueued = useCallback(async () => {
    if (promotingRef.current) return;
    if (queue.length === 0) return;
    promotingRef.current = true;
    try {
      const r = await fetch("/api/nex/agent/queue/next", { method: "POST" });
      const j = await r.json();
      if (j.ok && j.submitted?.task_id) {
        setActiveId(j.submitted.task_id);
        setTab("code");
        void loadTasks();
        void loadQueue();
        setToast({
          kind: "queued",
          title: "Next queued task started",
          body: `NEX1 picked up queue entry ${j.entry?.id?.slice(0, 8) ?? ""}`,
        });
        setTimeout(() => setToast(null), 4500);
      }
    } catch { /* transient */ }
    finally { promotingRef.current = false; }
  }, [queue.length, loadTasks, loadQueue]);

  // Auto-promote when active task reaches a terminal state and queue has items
  useEffect(() => {
    if (!activeTask) return;
    if (!AUTO_PROMOTE_STATUSES.has(activeTask.status)) return;
    if (queue.length === 0) return;
    // Debounce · give the SSE stream a moment to settle
    const t = setTimeout(() => { void promoteNextQueued(); }, 1200);
    return () => clearTimeout(t);
  }, [activeTask?.status, queue.length, promoteNextQueued]);   // eslint-disable-line react-hooks/exhaustive-deps

  const stopTask = async () => {
    if (!activeTask || stopping) return;
    setStopping(true); setErr(null);
    try {
      const r = await fetch("/api/nex/agent/stop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task_id: activeTask.task_id, stopped_by: "founder", reason: "founder pressed stop" }),
      });
      const j = await r.json();
      if (!j.ok) setErr(`stop failed: ${j.error ?? "unknown"}${j.detail ? ` · ${j.detail}` : ""}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "stop failed"); }
    finally { setStopping(false); }
  };

  const onFileChosen = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = ev.target.files;
    if (!files || files.length === 0) return;
    setUploading(true); setErr(null);
    try {
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append("file", f);
        form.append("uploaded_by", "founder");
        const r = await fetch("/api/nex/agent/upload", { method: "POST", body: form });
        const j = await r.json();
        if (j.ok) {
          setAttachments((prev) => [...prev, {
            id: j.id, filename: j.filename, mimeType: j.mimeType, size: j.size,
            isImage: j.isImage, isText: j.isText, previewUrl: j.previewUrl, uploadedAt: j.uploadedAt,
            formatChoiceId: null, formatChoiceLabel: null,
          }]);
        } else {
          setErr(`upload failed: ${j.error ?? "unknown"}${j.detail ? ` · ${j.detail}` : ""}`);
        }
      }
    } catch (e) { setErr(e instanceof Error ? e.message : "upload failed"); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    void fetch(`/api/nex/agent/upload?id=${id}`, { method: "DELETE" }).catch(() => { /* ignore · file stays on disk for audit */ });
  };

  const eraseTask = async (taskId: string) => {
    if (!confirm(`Erase task ${taskId.slice(0, 8)}? Drops the branch and wipes the changes from live + preview. Founder-only.`)) return;
    try {
      const r = await fetch("/api/nex/agent/erase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task_id: taskId, erased_by: "founder" }),
      });
      const j = await r.json();
      if (!j.ok) setErr(`erase failed: ${j.error ?? "unknown"}${j.detail ? ` · ${j.detail}` : ""}`);
      else {
        if (activeId === taskId) { setActiveId(null); setActiveTask(null); setSteps([]); }
        void loadTasks();
        setReloadNonce((n) => n + 1);
      }
    } catch (e) { setErr(e instanceof Error ? e.message : "erase failed"); }
  };

  const connectGh = async () => {
    if (!ghInput.trim() || ghBusy) return;
    setGhBusy(true); setGhMsg(null);
    try {
      const r = await fetch("/api/nex/agent/github", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoUrl: ghInput.trim(), connectedBy: "founder" }),
      });
      const j = await r.json();
      if (j.ok) {
        setGh(j.connection); setGhInput("");
        setGhMsg(`connected · ${j.connection.owner}/${j.connection.repo}`);
        // New project connected · clear history older than 7 days
        void runHistoryCleanup("github_connect");
        void loadTasks();
      }
      else setGhMsg(j.detail ? `${j.error} · ${j.detail}` : j.error ?? "connect failed");
    } catch (e) { setGhMsg(e instanceof Error ? e.message : "connect failed"); }
    finally { setGhBusy(false); }
  };

  const disconnectGh = async () => {
    if (!gh) return;
    if (!confirm(`Disconnect ${gh.owner}/${gh.repo}?`)) return;
    try {
      await fetch("/api/nex/agent/github", { method: "DELETE" });
      setGh(null);
      setGhMsg("disconnected");
    } catch { /* ignore */ }
  };

  const visibleTasks = useMemo(() => tasks.filter((t) => t.status !== "erased").slice(0, 25), [tasks]);
  const isCoding = activeTask && ACTIVELY_CODING_STATUSES.has(activeTask.status);

  // Derive screens (pages) from every task's plan.proposed_files
  const detectedScreens = useMemo(() => {
    const out: Array<{ route: string; filePath: string; taskId: string; taskPrompt: string }> = [];
    for (const t of visibleTasks) {
      const plan = t.plan as { proposed_files?: Array<{ path?: string }> } | null | undefined;
      const paths = plan?.proposed_files?.map((f) => String(f?.path ?? "")) ?? [];
      for (const p of paths) {
        const m = /^src\/app\/(.+?)\/page\.tsx?$/.exec(p);
        if (!m) continue;
        const segments = m[1].split("/").filter((s) => !(s.startsWith("(") && s.endsWith(")")));
        const route = "/" + segments.join("/").replace(/\[([^\]]+)\]/g, ":$1");
        out.push({ route, filePath: p, taskId: t.task_id, taskPrompt: t.prompt });
      }
    }
    return out;
  }, [visibleTasks]);

  const pageFilesForSeo = useMemo(() => detectedScreens.map((s) => s.filePath), [detectedScreens]);

  // Scale-to-fit math · fluid = fill · fixed = min(w-ratio, h-ratio)
  const baseViewSize = VIEWPORTS[viewport];

  // Resolve mobile size from the picked phone model (or custom dimensions).
  const mobileModel: PhoneModel | null = viewport === "mobile" && phoneModelId !== "custom"
    ? modelById(phoneModelId)
    : null;
  const mobileScreenW = viewport === "mobile"
    ? (mobileModel ? mobileModel.width : customMobile.w)
    : baseViewSize.w;
  const mobileScreenH = viewport === "mobile"
    ? (mobileModel ? mobileModel.height : customMobile.h)
    : baseViewSize.h;

  // Effective screen dimensions (respect mobile model if mobile viewport)
  const effectiveViewSize = viewport === "mobile"
    ? { w: mobileScreenW, h: mobileScreenH, label: mobileModel ? `${mobileModel.brand} ${mobileModel.name}` : `Custom ${customMobile.w}×${customMobile.h}`, fluid: false }
    : baseViewSize;

  // Bezel padding on mobile · zero when bezel hidden
  const MOBILE_BEZEL_X = 24;
  const MOBILE_BEZEL_Y = 32;
  const bezelX = viewport === "mobile" && showBezel ? MOBILE_BEZEL_X : 0;
  const bezelY = viewport === "mobile" && showBezel ? MOBILE_BEZEL_Y : 0;

  const baseScale = useMemo(() => {
    if (effectiveViewSize.fluid) return 1;
    if (wrapSize.w === 0 || wrapSize.h === 0) return 1;
    const outerW = effectiveViewSize.w + bezelX;
    const outerH = effectiveViewSize.h + bezelY;
    return Math.min(wrapSize.w / outerW, wrapSize.h / outerH);
  }, [wrapSize, effectiveViewSize.w, effectiveViewSize.h, effectiveViewSize.fluid, bezelX, bezelY]);
  const scale = baseScale * zoom;
  const outerW = effectiveViewSize.fluid ? effectiveViewSize.w : effectiveViewSize.w + bezelX;
  const outerH = effectiveViewSize.fluid ? effectiveViewSize.h : effectiveViewSize.h + bezelY;

  const cutout: CutoutSpec | null = viewport === "mobile" && mobileModel && showCutoutOutline
    ? mobileModel.cutout
    : null;
  const bezelColor = useCustomBezel ? customBezelColor(customBezelHex) : bezelColorById(bezelColorId);

  const iframeSrc = `${previewUrl}${previewUrl.includes("?") ? "&" : "?"}_t=${reloadNonce}`;

  const ghDot =
    !gh ? "disconnected" :
    gh.reachable === true ? "connected" :
    gh.reachable === false ? "unreachable" : "unknown";
  const ghDotTitle =
    !gh ? "no repo connected" :
    gh.reachable === true ? `connected · ${gh.owner}/${gh.repo} · reachable` :
    gh.reachable === false ? `${gh.owner}/${gh.repo} · 404 not found` :
    `${gh.owner}/${gh.repo} · reachability unknown`;

  // Error Guardian · absorbs errors + shows positive framing while nex1/2/3 fix
  const guardian = useErrorGuardian();

  // Hide scrollbars inside the preview iframe · same-origin only (silently
  // skipped for cross-origin content). Keeps the app view looking clean at
  // mobile / tablet / desktop with no scroll chrome inside the frame.
  const hideIframeScrollbars = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    try {
      const doc = e.currentTarget.contentDocument;
      if (!doc) return;
      if (doc.getElementById("naw-scrollbar-hider")) return;
      const style = doc.createElement("style");
      style.id = "naw-scrollbar-hider";
      style.textContent = `
        html, body, * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        html::-webkit-scrollbar,
        body::-webkit-scrollbar,
        *::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }
      `;
      (doc.head ?? doc.documentElement).appendChild(style);
    } catch { /* cross-origin · CORS blocks access · silently skip */ }
  };

  return (
    <div className="naw-root">
      <header className="naw-header">
        <div className="naw-header-left">
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="naw-live-dot" />
            <Nex1Brand size={22} />
            <span style={{ fontSize: 11, color: "var(--naw-slate)", fontWeight: 400, letterSpacing: 0 }}>Programming Workstation</span>
            <span style={{ fontSize: 9, color: "var(--naw-slate)", fontFamily: "'JetBrains Mono', monospace", marginLeft: 4 }}>stream · {streamState}</span>
          </h1>
          <div className="naw-subtitle">NEX1 codes · Master AI Engineer + Claude review · SEO Agent + Security Agent + isolated preview</div>
          {/* Active Project · honest 4-state chip · Rule 6 · no silent selection */}
          <div
            data-nex-ui="workstation-active-project"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              marginTop: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
              padding: "3px 8px", borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: activeProjectState?.status === "RESOLVED"
                ? "var(--naw-success, #16a34a)"
                : activeProjectState?.status === "INVALID"
                  ? "#f87171"
                  : "var(--naw-slate, #64748b)",
              maxWidth: 420,
            }}
            title={
              activeProjectState?.status === "RESOLVED" ? activeProjectState.workspace_root :
              activeProjectState?.status === "INVALID" ? activeProjectState.reason :
              activeProjectState?.status === "AMBIGUOUS" ? `${activeProjectState.count} candidates · customer must choose` :
              activeProjectState?.status === "NOT_AVAILABLE" ? activeProjectState.reason :
              "resolving…"
            }
          >
            <span style={{ opacity: 0.6 }}>Active project:</span>
            <span style={{ fontWeight: 600 }}>
              {activeProjectState?.status === "RESOLVED" ? activeProjectState.project_name :
               activeProjectState?.status === "AMBIGUOUS" ? `ambiguous · ${activeProjectState.count} candidates` :
               activeProjectState?.status === "INVALID" ? "invalid" :
               activeProjectState?.status === "NOT_AVAILABLE" ? "not selected" :
               "…"}
            </span>
          </div>
        </div>

        <div className="naw-header-right">
          {/* Compact GitHub icon button · dropdown reveals input + provider signup shortcuts */}
          <GitHubConnectButton
            gh={gh}
            onConnected={(conn) => { setGh(conn); void runHistoryCleanup("github_connect"); void loadTasks(); }}
            onDisconnected={() => setGh(null)}
          />
          {/* Compact Backend icon button · dropdown reveals 12 providers · click auto-opens signup */}
          <ProviderConnectButton
            lastPickedId={lastProviderId}
            onProviderPicked={(provider) => {
              setLastProviderId(provider.id);
              setPrompt(provider.promptTemplate);
              setTab("code");
              setTimeout(() => {
                const el = promptTextareaRef.current;
                if (el) {
                  el.focus();
                  el.style.height = "auto";
                  el.style.height = Math.min(Math.max(el.scrollHeight, PROMPT_MIN_H), PROMPT_MAX_H) + "px";
                }
              }, 40);
            }}
          />
          <HqBackButton />
        </div>
      </header>

      {/* ─── LEFT · scale-to-fit live preview ──────────────────────────── */}
      {/* ─── FAR LEFT · sidebar (SEO · Screens · Mobile controls) ───── */}
      <aside className="naw-sidebar">
        <SeoAgentPanel
          activePrompt={activeTask?.prompt ?? prompt}
          activeTaskId={activeTask?.task_id ?? null}
          taskStatus={activeTask?.status ?? null}
          pageFiles={pageFilesForSeo}
        />
        <ScreensDock
          screens={detectedScreens}
          currentUrl={previewUrl}
          onOpen={(effectiveRoute) => {
            setLeftMode("preview");
            setPreviewUrl(effectiveRoute);
            setReloadNonce((n) => n + 1);
          }}
          onContinuePrompt={(s, effectiveRoute) => {
            setPrompt(`Continue building the ${effectiveRoute} screen · UI · logic · edge cases · make it feel world-class. Reference file: ${s.filePath}`);
            promptTextareaRef.current?.focus();
            setTab("code");
          }}
        />
        <LearningPanel />
        <MobileControlsPanel
          visible={viewport === "mobile"}
          phoneModelId={phoneModelId}
          setPhoneModelId={setPhoneModelId}
          customMobile={customMobile}
          setCustomMobile={setCustomMobile}
          showBezel={showBezel}
          setShowBezel={setShowBezel}
          bezelColorId={bezelColorId}
          setBezelColorId={setBezelColorId}
          useCustomBezel={useCustomBezel}
          setUseCustomBezel={setUseCustomBezel}
          customBezelHex={customBezelHex}
          setCustomBezelHex={setCustomBezelHex}
          showCutoutOutline={showCutoutOutline}
          setShowCutoutOutline={setShowCutoutOutline}
        />
      </aside>

      <section className="naw-left">

        <div className="naw-preview-frame-wrap" ref={previewWrapRef} style={{ position: "relative" }} data-nex-ui="workstation-preview-frame">
          <SketchOverlay
            enabled={sketchMode}
            onExit={() => setSketchMode(false)}
            onExport={async (dataUrl) => {
              if (!dataUrl) return;
              // Upload the sketch PNG as an attachment · scanned by upload endpoint
              try {
                const res = await fetch(dataUrl);
                const blob = await res.blob();
                const form = new FormData();
                form.append("file", new File([blob], `sketch-${Date.now()}.png`, { type: "image/png" }));
                form.append("uploaded_by", "founder");
                const r = await fetch("/api/nex/agent/upload", { method: "POST", body: form });
                const j = await r.json();
                if (j.ok) {
                  setAttachments((prev) => [...prev, {
                    id: j.id, filename: j.filename, mimeType: j.mimeType, size: j.size,
                    isImage: j.isImage, isText: j.isText, previewUrl: j.previewUrl, uploadedAt: j.uploadedAt,
                    formatChoiceId: "discuss-format", formatChoiceLabel: "Sketch annotation from founder · use as visual reference",
                  }]);
                  setSketchAttachedUrl(j.previewUrl);
                  setTimeout(() => setSketchAttachedUrl(null), 3000);
                }
              } catch { /* transient */ }
            }}
          />
          <div className="naw-preview-frame-inner">
            {leftMode === "editor" && editorTaskId ? (
              <EditCodeEditor
                taskId={editorTaskId}
                task={tasks.find((t) => t.task_id === editorTaskId) ?? null}
                onExit={() => { setLeftMode("preview"); setEditorTaskId(null); }}
              />
            ) : effectiveViewSize.fluid ? (
              <div
                className="naw-preview-frame"
                style={{ width: "100%", height: "100%" }}
              >
                <iframe
                  key={iframeSrc}
                  src={iframeSrc}
                  title="Live app preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  onLoad={hideIframeScrollbars}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            ) : (
              // Scaled-outer-wrapper pattern · outer takes SCALED layout size · inner
              // holds the natural viewport-size element with transform: scale from
              // top-left. This keeps the flex box in sync with the visible pixel
              // dimensions · header can never crop the top of the frame.
              <div style={{
                width: outerW * scale,
                height: outerH * scale,
                position: "relative",
                overflow: "visible",
              }}>
                {viewport === "mobile" && showBezel ? (
                  <div
                    className={`naw-preview-frame naw-preview-frame--phone bezel-${mobileModel?.bezelStyle ?? "iphone-modern"}`}
                    style={{
                      width: outerW, height: outerH,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                      background: bezelColor.outer,
                    }}
                  >
                    <span className="naw-phone-side-button left-top" />
                    <span className="naw-phone-side-button left-mid" />
                    <span className="naw-phone-side-button left-low" />
                    <span className="naw-phone-side-button right-top" />
                    <div className="naw-preview-phone-screen" style={{ width: effectiveViewSize.w, height: effectiveViewSize.h }}>
                      <iframe
                        key={iframeSrc}
                        src={iframeSrc}
                        title="Live app preview · mobile"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        onLoad={hideIframeScrollbars}
                        style={{ width: "100%", height: "100%", border: "none", background: "#000", borderRadius: 40 }}
                      />
                      {cutout && cutout.kind !== "none" && (
                        <PhoneCutoutOverlay cutout={cutout} screenW={effectiveViewSize.w} />
                      )}
                    </div>
                    {(mobileModel?.bezelStyle === "iphone-modern" || mobileModel?.bezelStyle === "android-modern") && (
                      <div className="naw-phone-home-bar" />
                    )}
                  </div>
                ) : viewport === "mobile" && !showBezel ? (
                  // Bezel off · plain rectangular screen at chosen dimensions · cutout still visible
                  <div
                    className="naw-preview-frame naw-preview-frame--bare"
                    style={{
                      width: outerW, height: outerH,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                      position: "relative",
                    }}
                  >
                    <iframe
                      key={iframeSrc}
                      src={iframeSrc}
                      title="Live app preview · mobile · no bezel"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      onLoad={hideIframeScrollbars}
                      style={{ width: "100%", height: "100%", border: "none", background: "#000" }}
                    />
                    {cutout && cutout.kind !== "none" && (
                      <PhoneCutoutOverlay cutout={cutout} screenW={effectiveViewSize.w} />
                    )}
                  </div>
                ) : (
                  <div
                    className="naw-preview-frame"
                    style={{
                      width: outerW, height: outerH,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <iframe
                      key={iframeSrc}
                      src={iframeSrc}
                      title="Live app preview"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      onLoad={hideIframeScrollbars}
                      style={{ width: outerW, height: outerH }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── BOTTOM · preview control strip (viewport · URL · reload · zoom · sketch · voice · status) ── */}
        <div className="naw-preview-controls">
          <div className="naw-viewport-picker">
            {(Object.keys(VIEWPORTS) as Viewport[]).map((v) => (
              <button
                key={v}
                type="button"
                className={`naw-viewport-btn ${viewport === v ? "active" : ""}`}
                onClick={() => setViewport(v)}
              >{v}</button>
            ))}
          </div>
          <input
            className="naw-preview-url-input"
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
            placeholder="/nexapp"
            spellCheck={false}
          />
          <button type="button" className="naw-btn-secondary" onClick={() => setReloadNonce((n) => n + 1)} data-nex-ui="workstation-preview-reload">↻ Reload</button>
          <button
            type="button"
            className="naw-btn-secondary"
            onClick={runSaveInspect}
            disabled={saveInspecting}
            data-nex-ui="workstation-save"
            title="See your project state · Save does not silently commit, push, or publish"
          >{saveInspecting ? "…" : "💾 Save"}</button>
          <button
            type="button"
            className="naw-btn-secondary"
            onClick={async () => {
              if (activeProjectState?.status !== "RESOLVED") return;
              try {
                const resp = await fetch("/api/nex1/project/run", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ active_project_id: activeProjectId, action: "start" }),
                  cache: "no-store",
                });
                const j = await resp.json();
                if (j.ok && j.preview_url) {
                  setPreviewUrl(j.preview_url);
                  setReloadNonce((n) => n + 1);
                }
              } catch { /* silent · UI toast could surface this later */ }
            }}
            disabled={activeProjectState?.status !== "RESOLVED"}
            data-nex-ui="workstation-run-project"
            title={activeProjectState?.status === "RESOLVED"
              ? `Start the dev server for "${activeProjectState.project_name}" · Rule 6 · explicit customer action`
              : "Run project is disabled · no active project resolved · this button never runs the NEX repository"}
          >▶ Run project</button>
          <button
            type="button"
            className="naw-btn-secondary"
            onClick={async () => {
              if (activeProjectState?.status !== "RESOLVED") return;
              try {
                const resp = await fetch("/api/nex1/project/export", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ active_project_id: activeProjectId, action: "archive" }),
                  cache: "no-store",
                });
                const j = await resp.json();
                if (j.ok) {
                  const m = j.manifest;
                  setErr(`Archive created · ${m.files_included} files · ${m.archive_bytes} bytes · sha256 ${m.archive_sha256.slice(0, 12)}… · at ${m.archive_path}`);
                } else if (j.refused) {
                  setErr(`Export refused · ${j.refused} · ${j.reason}`);
                } else {
                  setErr("Export failed");
                }
              } catch (e) {
                setErr(e instanceof Error ? e.message : "export_error");
              }
            }}
            disabled={activeProjectState?.status !== "RESOLVED"}
            data-nex-ui="workstation-export-project"
            title={activeProjectState?.status === "RESOLVED"
              ? `Archive the workspace of "${activeProjectState.project_name}" · Rule 6 · explicit customer action · excludes node_modules / .git / .env / etc.`
              : "Export project is disabled · no active project resolved · this button never archives the NEX repository"}
          >⬇ Export project</button>
          <div className="naw-zoom-picker">
            <button
              type="button"
              className="naw-zoom-btn"
              onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 100) / 100))}
              disabled={zoom <= 0.25}
              title="Zoom out"
              aria-label="Zoom out"
            >−</button>
            <span className="naw-zoom-value">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="naw-zoom-btn"
              onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 100) / 100))}
              disabled={zoom >= 3}
              title="Zoom in"
              aria-label="Zoom in"
            >+</button>
            <button
              type="button"
              className="naw-zoom-btn"
              onClick={() => setZoom(1)}
              disabled={zoom === 1}
              title="Reset zoom · 100%"
              aria-label="Reset zoom"
              style={{ fontSize: 10 }}
            >100%</button>
          </div>

          {/* Sketch + Voice + Snapshot buttons · in the bottom strip */}
          <button
            type="button"
            className={`naw-btn-secondary ${sketchMode ? "active" : ""}`}
            onClick={() => { setSketchMode((v) => !v); setVoiceMode(false); }}
            title="Sketch mode · draw annotations over the preview · press S · Esc to exit"
            style={sketchMode ? { color: "var(--naw-orange)", borderColor: "var(--naw-orange)" } : undefined}
          >✎ Sketch</button>
          <button
            type="button"
            className={`naw-btn-secondary ${voiceMode ? "active" : ""}`}
            onClick={() => { setVoiceMode((v) => !v); setSketchMode(false); setVoiceRecorderMode(false); }}
            title="Voice mode · dictate the prompt via Web Speech API · press V · Esc to exit"
            style={voiceMode ? { color: "var(--naw-cyan)", borderColor: "var(--naw-cyan)" } : undefined}
          >🎙 Voice</button>
          <button
            type="button"
            className={`naw-btn-secondary ${voiceRecorderMode ? "active" : ""}`}
            onClick={() => { setVoiceRecorderMode((v) => !v); setSketchMode(false); setVoiceMode(false); }}
            title="Voice-over recorder · record audio for the project · uploads as attachment"
            style={voiceRecorderMode ? { color: "var(--naw-orange)", borderColor: "var(--naw-orange)" } : undefined}
          >● Rec</button>

          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--naw-slate)", fontFamily: "'JetBrains Mono', monospace" }}>
            {effectiveViewSize.fluid
              ? `Fluid · wrap ${Math.round(wrapSize.w)}×${Math.round(wrapSize.h)}`
              : `${effectiveViewSize.w}×${effectiveViewSize.h} · ${Math.round(scale * 100)}% (fit ${Math.round(baseScale * 100)}% · zoom ${Math.round(zoom * 100)}%)`}
          </span>
        </div>

        {/* ═════ NEX CHAT COMPOSER · directly under LIVE APP PREVIEW · founder 2026-09-19 ═════
            Uses the same `prompt` state + `submit` handler as the full prompt-bar in
            the right-side menu. Buttons (upload · voice · stop · advanced) remain in
            the right-side menu · this composer under the preview is the primary
            interaction surface. */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 16px",
            background: "var(--naw-panel, #0F1A2F)",
            borderTop: "1px solid var(--naw-line, #1E2E4A)",
            alignItems: "flex-end",
          }}
          aria-label="NEX chat composer · under live preview"
        >
          <textarea
            className="naw-prompt-textarea"
            data-nex-ui="workstation-chat-input"
            placeholder={
              activeTask?.status === "clarifying"
                ? "Answer NEX1's clarifying question…"
                : "Ask NEX to build or change something…"
            }
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(Math.max(el.scrollHeight, 40), 120) + "px";
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && (prompt.trim() || attachments.length > 0) && !submitting) void submit();
              // Also allow plain Enter (without shift) to send when there's no newline intent
              if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && (prompt.trim() || attachments.length > 0) && !submitting) {
                e.preventDefault();
                void submit();
              }
            }}
            style={{
              flex: 1,
              minHeight: 40,
              maxHeight: 120,
              padding: "10px 14px",
              fontSize: 13,
              lineHeight: 1.4,
              borderRadius: 8,
              border: "1px solid var(--naw-line, #1E2E4A)",
              background: "var(--naw-bg, #0B1220)",
              color: "var(--naw-text, #E5EDF9)",
              fontFamily: "inherit",
              resize: "none",
            }}
          />
          <button
            type="button"
            onClick={() => { if (!submitting && (prompt.trim() || attachments.length > 0)) void submit(); }}
            disabled={submitting || (prompt.trim().length === 0 && attachments.length === 0)}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
              border: "1px solid var(--naw-accent, #FFB300)",
              background: submitting || (prompt.trim().length === 0 && attachments.length === 0)
                ? "var(--naw-panel, #0F1A2F)"
                : "var(--naw-accent, #FFB300)",
              color: submitting || (prompt.trim().length === 0 && attachments.length === 0)
                ? "var(--naw-slate, #94A3B8)"
                : "#0B1220",
              cursor: submitting || (prompt.trim().length === 0 && attachments.length === 0) ? "not-allowed" : "pointer",
              alignSelf: "stretch",
            }}
            aria-label="Send to NEX"
            title="Send to NEX · Enter to send · Ctrl/Cmd+Enter to submit"
            data-nex-ui="workstation-chat-send"
          >
            {submitting ? "…" : "Send ➤"}
          </button>
        </div>
      </section>

      {/* ─── RIGHT · programming panel ─────────────────────────────────── */}
      <aside className="naw-right">
        {/* ActorRibbon removed 2026-09-17 · founder request. Thinking indicator moved inline into the Code panel. */}
        {/* Constitutional ticker · scrolling doctrine + guardian stats */}
        <ConstitutionalTicker />
        {/* Square icon-over-label tab tiles · founder redesign 2026-09-17.
            Order: Code (first + default) → History → Plugins → Loop → Repo.
            Each tile is a small square: big glyph on top, short name below.
            The Code tile gets an orange border pulse when NEX1 is coding.
            Task status pill removed · lives inline in the Code panel now. */}
        <div className="naw-tabs-row naw-tabs-tiles">
          <button
            type="button"
            className={`naw-tab-tile ${tab === "code" ? "active" : ""} ${isCoding ? "coding" : ""}`}
            onClick={() => setTab("code")}
            title={isCoding ? "NEX1 is coding now" : "Live coding feed for the current task"}
            data-nex-ui="workstation-tile-code"
          >
            <span className="naw-tile-glyph">⌘</span>
            <span className="naw-tile-label">Code</span>
            <span className="naw-tile-sub">
              {isCoding ? <><span className="naw-live-dot" /> LIVE</> : (activeTask ? activeTask.status.replace(/_/g, " ") : "idle")}
            </span>
          </button>
          <button
            type="button"
            className={`naw-tab-tile ${tab === "history" ? "active" : ""}`}
            onClick={() => setTab("history")}
            title="Task history"
            data-nex-ui="workstation-tile-history"
          >
            <span className="naw-tile-glyph">◧</span>
            <span className="naw-tile-label">History</span>
            <span className="naw-tile-sub">{visibleTasks.length}</span>
          </button>
          <button
            type="button"
            className={`naw-tab-tile ${tab === "plugins" ? "active" : ""}`}
            onClick={() => setTab("plugins")}
            title="Plugins · founder-vetted integrations that add serious value"
            data-nex-ui="workstation-tile-plugins"
          >
            <span className="naw-tile-glyph">◈</span>
            <span className="naw-tile-label">Plugins</span>
            <span className="naw-tile-sub">&nbsp;</span>
          </button>
          <button
            type="button"
            className={`naw-tab-tile ${tab === "native-loop" ? "active" : ""}`}
            onClick={() => setTab("native-loop")}
            title="NEX1 Native Programming Loop · deterministic · zero LLM"
            data-nex-ui="workstation-tile-loop"
          >
            <span className="naw-tile-glyph">⧗</span>
            <span className="naw-tile-label">Loop</span>
            <span className="naw-tile-sub">native</span>
          </button>
          <button
            type="button"
            className={`naw-tab-tile ${tab === "repo" ? "active" : ""}`}
            onClick={() => setTab("repo")}
            title="Corpus repo · onboarding · file preview · workstation chat · zero LLM"
            data-nex-ui="workstation-tile-repo"
          >
            <span className="naw-tile-glyph">◱</span>
            <span className="naw-tile-label">Repo</span>
            <span className="naw-tile-sub">corpus</span>
          </button>
          <button
            type="button"
            className={`naw-tab-tile ${tab === "notes" ? "active" : ""}`}
            onClick={() => setTab("notes")}
            title="NEX1's Notes · preferences · corrections · refused prompts · zero LLM"
            data-nex-ui="workstation-tile-notes"
          >
            <span className="naw-tile-glyph">◊</span>
            <span className="naw-tile-label">Notes</span>
            <span className="naw-tile-sub">memory</span>
          </button>
        </div>

        <div className="naw-panel" ref={tab === "code" ? feedRef : null}>
          {tab === "repo" ? (
            <RepoOnboardPanel
              onShowInPhone={(previewUrl) => {
                // Route the LEFT app-phone iframe at the sandboxed repo preview.
                // Force preview mode (not editor) so the iframe is what renders.
                setLeftMode("preview");
                setPreviewUrl(previewUrl);
                setReloadNonce((n) => n + 1);
              }}
            />
          ) : tab === "notes" ? (
            // C10 Phase 3 · session graph key wins over task_id · shows the
            // cross-task memory for this browser tab. If no session id yet,
            // fall back to active task id (per-task graph).
            <NotesPanel activeTaskId={sessionId || activeTask?.task_id || null} />
          ) : tab === "native-loop" ? (
            <NativeLoopPanel />
          ) : tab === "plugins" ? (
            <PluginsPanel
              onAdd={(plugin) => {
                // Compose the founder-facing prompt · then focus prompt textarea
                setPrompt(plugin.promptTemplate);
                setTimeout(() => {
                  const el = promptTextareaRef.current;
                  if (el) {
                    el.focus();
                    el.style.height = "auto";
                    el.style.height = Math.min(Math.max(el.scrollHeight, PROMPT_MIN_H), PROMPT_MAX_H) + "px";
                  }
                }, 30);
                setTab("code");
              }}
            />
          ) : tab === "history" ? (
            visibleTasks.length === 0 ? (
              <div className="naw-panel-empty">
                <div style={{ fontSize: 32, opacity: 0.4, marginBottom: 8 }}>◧</div>
                <div style={{ fontWeight: 600, color: "var(--naw-soft-white)", marginBottom: 4 }}>No tasks yet</div>
                <div>Type a prompt below to start · NEX1 will show up here as a card.</div>
              </div>
            ) : visibleTasks.map((t) => (
              <div
                key={t.task_id}
                className={`naw-landscape-card ${activeId === t.task_id ? "active" : ""}`}
                onClick={() => { setActiveId(t.task_id); setTab("code"); }}
              >
                <div className="naw-landscape-card-header">
                  <span className={`naw-badge ${STATUS_TONE[t.status] ?? "naw-badge-slate"}`}>{t.status}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      className="naw-view-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLeftMode("preview");
                        setPreviewUrl(derivePreviewUrl(t));
                        setReloadNonce((n) => n + 1);
                      }}
                      title="View this card's screen · switches LEFT preview to its target route"
                    >◧ VIEW</button>
                    <button
                      type="button"
                      className="naw-edit-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLeftMode("editor");
                        setEditorTaskId(t.task_id);
                      }}
                      title="Edit this card's code · LEFT becomes a code editor"
                    >✎ EDIT</button>
                    <a
                      className="naw-export-btn"
                      href={`/api/nex/agent/export?task_id=${t.task_id}`}
                      onClick={(e) => e.stopPropagation()}
                      download
                      title="Export this card's files + task metadata as a JSON bundle"
                    >⬇ EXPORT</a>
                    <button
                      type="button"
                      className="naw-erase-btn"
                      onClick={(e) => { e.stopPropagation(); void eraseTask(t.task_id); }}
                      title="Erase this code landscape · wipes from live + preview · founder-only"
                    >✕ ERASE</button>
                  </div>
                </div>
                <div className="naw-landscape-card-prompt">{t.prompt}</div>
                <div className="naw-landscape-card-meta">
                  <span className={`naw-day-chip naw-day-${dayLabel(t.submitted_at).replace(/\s+/g, "-").toLowerCase()}`}>{dayLabel(t.submitted_at)}</span>
                  <span>·</span>
                  <span>#{t.task_id.slice(0, 8)}</span>
                  <span>·</span>
                  <span>{new Date(t.updated_at).toLocaleTimeString()}</span>
                  {t.current_actor && <><span>·</span><span>{ACTOR_LABELS[t.current_actor as Step["actor"]] ?? t.current_actor}</span></>}
                </div>
              </div>
            ))
          ) : (
            <>
              {/* Founder rule 2026-09-17: the Code feed is a CHAT surface.
                  · Welcome to NEX1 persists at the top.
                  · User's prompt renders as a "You" bubble.
                  · NEX1's reply renders as an assistant bubble.
                  · Internal pipeline telemetry (thought/dispatch/routing) is
                    hidden · only user-facing step kinds surface.
                  · No raw JSON dumps · no actor initials · no timestamps in
                    the chat body · no step_kind labels. */}
              <div className="naw-welcome-block">
                <div className="naw-welcome-title">Welcome to NEX1</div>
              </div>
              {/* C11 UI chip · verdict + confidence for the current task's
                  most recent envelope. Colour-coded by verdict. Empty when
                  no envelope has been received yet for this task. */}
              {activeTask && taskEnvelopes[activeTask.task_id] && (() => {
                const env = taskEnvelopes[activeTask.task_id];
                const conf = `${Math.round(env.confidence * 100)}%`;
                const kls = `naw-uncert-chip naw-uncert-${env.verdict.replace(/_/g, "-")} naw-uncert-clickable`;
                return (
                  <button
                    type="button"
                    className={kls}
                    data-nex-verdict={env.verdict}
                    onClick={() => setInspectingEnvelope(activeTask.task_id)}
                    title="Click to inspect the full envelope · provenance · missing evidence · options"
                  >
                    <span className="naw-uncert-badge">{env.verdict.replace(/_/g, " ")}</span>
                    <span className="naw-uncert-conf">{conf}</span>
                    <span className="naw-uncert-reason">{env.reason}</span>
                    {env.next_action_hint && (
                      <span className="naw-uncert-hint">→ {env.next_action_hint}</span>
                    )}
                    <span className="naw-uncert-expand" aria-hidden="true">⤢</span>
                  </button>
                );
              })()}

              {/* Envelope inspector modal · opens on chip click · closes via
                  backdrop or × button. Shows verdict + confidence + reason +
                  provenance chain + missing_evidence + options + next_action_hint. */}
              {inspectingEnvelope && taskEnvelopes[inspectingEnvelope] && (() => {
                const env = taskEnvelopes[inspectingEnvelope];
                const conf = `${Math.round(env.confidence * 100)}%`;
                const verdictClass = `naw-env-modal-verdict naw-env-modal-verdict-${env.verdict.replace(/_/g, "-")}`;
                return (
                  <div
                    className="naw-env-modal-backdrop"
                    onClick={() => setInspectingEnvelope(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Envelope inspector"
                  >
                    <div className="naw-env-modal-panel" onClick={(e) => e.stopPropagation()}>
                      <div className="naw-env-modal-header">
                        <div>
                          <div className={verdictClass}>{env.verdict.replace(/_/g, " ")}</div>
                          <div className="naw-env-modal-conf">{conf} confidence</div>
                        </div>
                        <button
                          type="button"
                          className="naw-env-modal-close"
                          onClick={() => setInspectingEnvelope(null)}
                          aria-label="Close envelope inspector"
                        >×</button>
                      </div>
                      <div className="naw-env-modal-body">
                        <section className="naw-env-modal-section">
                          <div className="naw-env-modal-section-title">Reason</div>
                          <div className="naw-env-modal-section-body">{env.reason}</div>
                        </section>
                        {env.next_action_hint && (
                          <section className="naw-env-modal-section">
                            <div className="naw-env-modal-section-title">Next action</div>
                            <div className="naw-env-modal-section-body">→ {env.next_action_hint}</div>
                          </section>
                        )}
                        {env.provenance && env.provenance.length > 0 && (
                          <section className="naw-env-modal-section">
                            <div className="naw-env-modal-section-title">Provenance chain <span className="naw-env-modal-hint">· click to jump</span></div>
                            <ul className="naw-env-modal-list">
                              {env.provenance.map((p, i) => {
                                const isStepRef = p.kind === "step_id";
                                const isTaskRef = p.kind === "trace_key" && p.value.startsWith("task=");
                                const isSemantic = p.kind === "semantic_tag";
                                const clickable = isStepRef || isTaskRef;
                                const kindClass = isStepRef ? "naw-env-prov-kind-step"
                                  : isTaskRef ? "naw-env-prov-kind-trace"
                                  : isSemantic ? "naw-env-prov-kind-tag"
                                  : "naw-env-prov-kind-other";
                                const kindIcon = isStepRef ? "▸"
                                  : isTaskRef ? "⇔"
                                  : isSemantic ? "#"
                                  : "·";
                                return (
                                  <li
                                    key={i}
                                    className={`${kindClass}${clickable ? " naw-env-prov-clickable" : ""}`}
                                    tabIndex={clickable ? 0 : -1}
                                    role={clickable ? "button" : undefined}
                                    onClick={() => {
                                      if (isStepRef) {
                                        // Try to find a matching step card by exact step_id.
                                        // Envelope provenance emits semantic labels
                                        // (e.g. "consensus", "ambiguity_clarification")
                                        // which today do NOT match real step_ids in the
                                        // feed. When no DOM match is found, fall back to
                                        // clipboard so the value is still useful to the
                                        // founder (search-in-page etc.).
                                        const el = document.querySelector(`[data-step-id="${CSS.escape(p.value)}"]`) as HTMLElement | null;
                                        if (el) {
                                          el.scrollIntoView({ behavior: "smooth", block: "center" });
                                          el.classList.add("naw-feed-step-highlight");
                                          setTimeout(() => el.classList.remove("naw-feed-step-highlight"), 1600);
                                          setInspectingEnvelope(null);
                                        } else if (navigator?.clipboard?.writeText) {
                                          void navigator.clipboard.writeText(p.value);
                                        }
                                      } else if (isTaskRef) {
                                        // trace_key: task=<uuid> · copy the uuid.
                                        const uuid = p.value.slice("task=".length);
                                        if (navigator?.clipboard?.writeText) void navigator.clipboard.writeText(uuid);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (!clickable) return;
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        (e.currentTarget as HTMLElement).click();
                                      }
                                    }}
                                    title={isStepRef ? "Jump to this step in the feed" : isTaskRef ? "Copy task_id to clipboard" : isSemantic ? "Human-readable tag (not a link)" : undefined}
                                  >
                                    <span className="naw-env-prov-icon" aria-hidden="true">{kindIcon}</span>
                                    <code>{p.kind}</code> · <span>{p.value}</span>
                                    {clickable && <span className="naw-env-prov-arrow" aria-hidden="true"> ↗</span>}
                                  </li>
                                );
                              })}
                            </ul>
                          </section>
                        )}
                        {env.missing_evidence && env.missing_evidence.length > 0 && (
                          <section className="naw-env-modal-section">
                            <div className="naw-env-modal-section-title">Missing evidence ({env.missing_evidence.length})</div>
                            <ul className="naw-env-modal-list">
                              {env.missing_evidence.map((m, i) => (
                                <li key={i}><code>{m.kind}</code> · {m.description}</li>
                              ))}
                            </ul>
                          </section>
                        )}
                        {env.options && env.options.length > 0 && (
                          <section className="naw-env-modal-section">
                            <div className="naw-env-modal-section-title">Options ({env.options.length})</div>
                            <ul className="naw-env-modal-list">
                              {env.options.map((o, i) => (
                                <li key={i}><code>{o.id}</code> · {o.label}</li>
                              ))}
                            </ul>
                          </section>
                        )}
                        <div className="naw-env-modal-footer">
                          <span>task <code>{inspectingEnvelope.slice(0, 8)}…</code></span>
                          <div className="naw-env-modal-footer-actions">
                            <button
                              type="button"
                              className="naw-env-modal-copy"
                              onClick={async () => {
                                const payload = JSON.stringify(env, null, 2);
                                try {
                                  if (navigator?.clipboard?.writeText) {
                                    await navigator.clipboard.writeText(payload);
                                  } else {
                                    // Legacy fallback · rare · founder can still copy manually.
                                    const ta = document.createElement("textarea");
                                    ta.value = payload;
                                    ta.style.position = "fixed";
                                    ta.style.opacity = "0";
                                    document.body.appendChild(ta);
                                    ta.select();
                                    document.execCommand("copy");
                                    document.body.removeChild(ta);
                                  }
                                  setEnvelopeCopied(true);
                                  setTimeout(() => setEnvelopeCopied(false), 1500);
                                } catch { /* soft-fail · button just doesn't flip */ }
                              }}
                              title="Copy the full envelope as JSON to clipboard"
                            >{envelopeCopied ? "Copied ✓" : "Copy JSON"}</button>
                            {env.zero_llm && <span className="naw-env-modal-badge">NEX1_NATIVE · zero LLM</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* User's prompt · shown ABOVE NEX1's replies */}
              {activeTask?.prompt && (
                <div className="naw-chat-msg naw-chat-msg--user">
                  <div className="naw-chat-msg-role">You</div>
                  <div className="naw-chat-msg-body">{activeTask.prompt}</div>
                </div>
              )}
              {/* Thinking indicator · only while NEX1 is coding */}
              {activeTask && isCoding && (
                <div className="naw-thinking-inline naw-thinking-inline--feed">
                  <span className="naw-think-dots"><span/><span/><span/></span>
                  <span>NEX1 is coding…</span>
                </div>
              )}
              {/* Filter internal telemetry step kinds · only show what the
                  user actually needs to see. "thought" is internal reasoning
                  and produces raw JSON dumps · always hidden. */}
              {steps
                .filter((s) => !INTERNAL_STEP_KINDS.has(s.step_kind))
                .map((s) => (
                  <StepCard
                    key={s.step_id}
                    step={s}
                    activeTaskId={activeTask?.task_id ?? null}
                    decidedOption={decidedSteps[s.step_id] ?? null}
                    onDecide={submitDecision}
                    ambiguityPickedLetter={ambiguityPicks[s.step_id] ?? null}
                    onAmbiguityPick={handleAmbiguityPick}
                  />
                ))}

              {/* Queue · sits at the bottom of the Code panel · founder can queue up to 10 */}
              {/* Founder rule 2026-09-17: queue container is only visible
                  when NEX1 is ACTIVELY CODING · never when idle or awaiting
                  founder approval. If the queue has leftover items from a
                  previous coding session, they still auto-promote via the
                  existing effect · we just don't render them here. */}
              {queue.length > 0 && isCoding && (
                <div className="naw-queue-section">
                  <div className="naw-queue-header">
                    <span>▼ Queue</span>
                    <span className="naw-queue-count">{queue.length} / 10</span>
                    <span style={{ marginLeft: "auto", color: "var(--naw-slate)", textTransform: "none", letterSpacing: 0, fontWeight: 400, fontSize: 10 }}>
                      auto-starts when current task finishes
                    </span>
                  </div>
                  {queue.length >= 10 && (
                    <div className="naw-queue-full-banner">
                      Queue full · delete an entry before adding more
                    </div>
                  )}
                  {queue.map((q, i) => (
                    <div key={q.id} className="naw-queue-card">
                      <div className="naw-queue-card-header">
                        <span className="naw-queue-position-chip">{i + 1}</span>
                        <span>queued {new Date(q.queuedAt).toLocaleTimeString()}</span>
                        {q.classification && (
                          <span title={q.classification.reasoning} style={{ color: "var(--naw-slate)" }}>
                            · {q.classification.decision === "QUEUE_AS_NEW" ? "classified: new task" : "classified: merge (queued anyway)"}
                          </span>
                        )}
                        <button
                          type="button"
                          className="naw-queue-remove-btn"
                          onClick={() => void removeFromQueue(q.id)}
                          title="Remove from queue"
                          aria-label={`Remove queued prompt ${i + 1}`}
                        >✕</button>
                      </div>
                      <div className="naw-queue-card-prompt">{q.prompt}</div>
                      {q.attachments.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {q.attachments.map((a) => (
                            <span key={a.id} className="naw-badge naw-badge-cyan">{a.isImage ? "IMG" : "FILE"} · {a.filename}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="naw-prompt-bar">
          {err && (
            <div className="naw-feed-step actor-system" style={{ borderLeftColor: "var(--naw-danger)" }}>
              <div className="naw-feed-step-header"><span style={{ color: "var(--naw-danger)" }}>error</span></div>
              <div className="naw-feed-step-body">{err}</div>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="naw-attachments">
              {attachments.map((a) => {
                const opts = suggestFormats(a.filename, a.mimeType);
                const detected = detectHumanReadableFormat(a.filename, a.mimeType);
                return (
                  <div key={a.id} className="naw-attachment-chip" title={`${a.filename} · ${a.mimeType} · ${a.size} bytes`}>
                    {a.isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.previewUrl} alt={a.filename} />
                    ) : (
                      <span className="naw-attachment-chip-icon">
                        {a.mimeType.startsWith("text/") ? "TXT" : a.mimeType.includes("pdf") ? "PDF" : "FILE"}
                      </span>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                      <span className="naw-attachment-chip-name">{a.filename}</span>
                      <span className="naw-attachment-chip-size">{(a.size / 1024).toFixed(1)} KB · {detected}</span>
                      <select
                        className="naw-attachment-format-select"
                        value={a.formatChoiceId ?? ""}
                        onChange={(e) => {
                          const chosen = opts.find((o) => o.id === e.target.value);
                          setAttachments((prev) => prev.map((x) => x.id === a.id
                            ? { ...x, formatChoiceId: chosen?.id ?? null, formatChoiceLabel: chosen?.label ?? null }
                            : x));
                        }}
                        title="Pick target format · NEX1 keeps · converts · or discusses best option"
                      >
                        <option value="">— NEX1 will ask (recommended: {opts[0].label}) —</option>
                        {opts.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}{o.recommended ? " ★" : ""}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="naw-attachment-chip-remove"
                      onClick={() => removeAttachment(a.id)}
                      aria-label={`remove ${a.filename}`}
                    >×</button>
                  </div>
                );
              })}
            </div>
          )}

          <textarea
            ref={promptTextareaRef}
            className="naw-prompt-textarea"
            placeholder={
              activeTask?.status === "clarifying"
                ? "Answer NEX1's clarifying question…"
                : attachments.length > 0
                  ? `Add a message for NEX1 about the ${attachments.length} attachment${attachments.length > 1 ? "s" : ""}…`
                  : "Type a prompt for NEX1 · what should it build or change? · Paste URLs to have NEX1 scrape + rephrase them"
            }
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              // Auto-grow · up to 5x standard (300px)
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(Math.max(el.scrollHeight, PROMPT_MIN_H), PROMPT_MAX_H) + "px";
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && (prompt.trim() || attachments.length > 0) && !submitting) void submit();
            }}
            style={{ height: PROMPT_MIN_H }}
          />

          <div className="naw-prompt-row">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              {/* STOP button · round · red · far-left */}
              <button
                type="button"
                className={`naw-btn-stop ${isCoding ? "active-coding" : ""}`}
                onClick={stopTask}
                disabled={!activeTask || stopping || !isCoding}
                title={
                  !activeTask ? "No active task to stop"
                    : !isCoding ? `Task is ${activeTask.status} · nothing to stop`
                    : "Stop NEX1 · halts at next checkpoint · founder can send new instructions after"
                }
                aria-label="Stop NEX1"
              >
                <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1" /></svg>
              </button>

              {/* UPLOAD button · square · cyan · beside Stop */}
              <label
                className="naw-btn-upload"
                title="Upload image or file · NEX1 reads text files inline · vision-capable model reads images"
                style={{ position: "relative" }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,text/*,application/pdf,application/json,.md,.log,.csv,.yaml,.yml"
                  onChange={onFileChosen}
                  disabled={uploading}
                />
                {uploading ? (
                  <span style={{ fontSize: 10, fontFamily: "monospace" }}>…</span>
                ) : (
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M14.83 8.35 9.24 13.94a3.75 3.75 0 0 1-5.3-5.3l6-6a2.5 2.5 0 0 1 3.54 3.54l-6 6a1.25 1.25 0 0 1-1.77-1.77l5.65-5.66"
                      stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </label>

              <div style={{ fontSize: 10, color: "var(--naw-slate)", flex: 1, minWidth: 0 }}>
                ⌘/Ctrl + Enter to send
                {gh && <> · target: <code style={{ color: "var(--naw-cyan)" }}>{gh.owner}/{gh.repo}</code></>}
                {attachments.length > 0 && <> · <span style={{ color: "var(--naw-cyan)" }}>{attachments.length} attachment{attachments.length > 1 ? "s" : ""} ready</span></>}
              </div>
            </div>

            <button
              type="button"
              className="naw-btn-primary"
              onClick={submit}
              disabled={submitting || (!prompt.trim() && attachments.length === 0)}
            >{submitting ? "Sending…" : "Send →"}</button>
          </div>
        </div>
      </aside>

      {/* Error Guardian · absorbs raw errors · shows positive framing while
          nex1 · Engineer · Claude fix the issue in the background. Founder
          never sees a stack trace · never sees "500 Internal Server Error". */}
      {guardian.node}

      {/* Turbopack watchdog · pipes compile errors to NEX1 as fix tasks */}
      <TurbopackWatchdog />

      {/* Voice-over recorder · MediaRecorder API · saves audio as attachment */}
      <VoiceRecorderOverlay
        enabled={voiceRecorderMode}
        onExit={() => setVoiceRecorderMode(false)}
        onRecorded={(att) => {
          setAttachments((prev) => [...prev, {
            id: att.id, filename: att.filename, mimeType: att.mimeType, size: att.size,
            isImage: att.isImage, isText: att.isText, previewUrl: att.previewUrl, uploadedAt: att.uploadedAt,
            formatChoiceId: "discuss-format", formatChoiceLabel: "Voice-over recording · founder audio for the project",
          }]);
        }}
      />

      {/* Voice overlay · fixed bottom-right · Web Speech API dictation */}
      <VoiceOverlay
        enabled={voiceMode}
        onExit={() => setVoiceMode(false)}
        onTranscript={(text, appendMode) => {
          setPrompt((p) => {
            const next = appendMode ? (p ? p + " " + text : text) : text;
            return next;
          });
          // Auto-grow textarea to fit
          setTimeout(() => {
            const el = promptTextareaRef.current;
            if (el) {
              el.style.height = "auto";
              el.style.height = Math.min(Math.max(el.scrollHeight, PROMPT_MIN_H), PROMPT_MAX_H) + "px";
            }
          }, 20);
        }}
      />

      {/* Sketch-attached toast · brief green confirm */}
      {sketchAttachedUrl && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 220,
          background: "rgba(34, 197, 94, 0.14)",
          border: "1px solid rgba(34, 197, 94, 0.4)",
          borderRadius: 10, padding: "8px 12px",
          color: "var(--naw-success)", fontSize: 12, fontWeight: 700,
        }}>✓ Sketch attached · sent with next prompt</div>
      )}

      {/* Save envelope · appears after clicking Save · read-only state display.
        Does NOT auto-commit, push, or publish. Customer sees honest state and
        chooses what to do next (Rule 6 · customer sovereignty). */}
      {saveEnvelope && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Project save state"
          onClick={() => setSaveEnvelope(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            data-nex-ui="workstation-save-envelope"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 560, width: "100%",
              background: "var(--naw-panel, #0e0e12)",
              color: "var(--naw-text, #eaeaea)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              fontSize: 14, lineHeight: 1.5,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              {saveEnvelope.ok ? "Your project state" :
               saveEnvelope.refused === "NOT_AVAILABLE" ? "No active project selected" :
               saveEnvelope.refused === "AMBIGUOUS" ? "Multiple projects · choose one" :
               saveEnvelope.refused === "INVALID" ? "Project workspace is unavailable" :
               "Could not read project state"}
            </div>
            {saveEnvelope.ok ? (
              <>
                <div style={{ marginBottom: 12 }}>{saveEnvelope.plain_language_message}</div>
                <div style={{
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12,
                }}>
                  <div><strong>Project:</strong> {saveEnvelope.project_name}</div>
                  <div style={{ opacity: 0.7, wordBreak: "break-all" }}>{saveEnvelope.workspace_root}</div>
                  {saveEnvelope.branch && <div><strong>Branch:</strong> {saveEnvelope.branch}</div>}
                  {saveEnvelope.counts && (
                    <div>
                      <strong>Changes:</strong> {saveEnvelope.counts.modified} modified · {saveEnvelope.counts.untracked} untracked · {saveEnvelope.counts.staged} staged · {saveEnvelope.counts.deleted} deleted
                    </div>
                  )}
                  <div>
                    <strong>State:</strong> {saveEnvelope.close_flow_state}
                    {saveEnvelope.show_warning ? " ⚠" : ""}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 11, marginTop: 4 }}>
                    {saveEnvelope.remote_save_verified_reason}
                  </div>
                </div>
                {saveEnvelope.allowed_actions && saveEnvelope.allowed_actions.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Available next steps:</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                      {saveEnvelope.allowed_actions.map((a) => (
                        <li key={a} style={{ opacity: 0.85 }}>{a.replace(/_/g, " ")}</li>
                      ))}
                    </ul>
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
                      Save shows your state · does not silently commit, push, or publish.
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 11, opacity: 0.5 }}>
                  Evidence: {saveEnvelope.evidence_receipt_path} · digest {saveEnvelope.input_digest}
                </div>
              </>
            ) : (
              <div style={{ color: "#f87171", marginBottom: 12 }}>{saveEnvelope.reason ?? "unknown failure"}</div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                type="button"
                className="naw-btn-secondary"
                onClick={() => setSaveEnvelope(null)}
              >Close</button>
            </div>
          </div>
        </div>
      )}

      {/* NEX Orb · Step 8 · visual layer over already-real capabilities.
        Points at real DOM controls · NEVER invokes them (Rule 6 absolute). */}
      <WorkstationOrb />

      {/* Command palette · ⌘K opens · closes on Esc or selection */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        tasks={visibleTasks.map((t) => ({ task_id: t.task_id, prompt: t.prompt, status: t.status }))}
        ctx={{
          viewport, tab, zoom, activeTaskId: activeTask?.task_id ?? null,
          setTab, setViewport, setZoom, setShowBezel, setShowCutoutOutline, setReloadNonce, setPreviewUrl, setPhoneModelId,
          focusPrompt: () => promptTextareaRef.current?.focus(),
          submitPrompt: () => { if (!submitting && (prompt.trim() || attachments.length > 0)) void submit(); },
          stopTask: () => { if (activeTask && isCoding) void stopTask(); },
          openTaskById: (id) => { setActiveId(id); setTab("code"); },
          toggleAmbientSound: () => setAmbientSound((v) => !v),
          toggleZenMode: () => setZenMode((v) => !v),
          toggleFullscreenPreview: () => setFullscreenPreview((v) => !v),
        }}
      />

      {/* Toast · shows classification decision when founder sends while active */}
      {toast && (
        <div className={`naw-toast ${toast.kind}`} role="status" aria-live="polite">
          <div className={`naw-toast-title ${toast.kind}`}>{toast.title}</div>
          <div className="naw-toast-body">{toast.body}</div>
        </div>
      )}
    </div>
  );
}

function StepCard({
  step,
  activeTaskId,
  decidedOption,
  onDecide,
  ambiguityPickedLetter,
  onAmbiguityPick,
}: {
  step: Step;
  activeTaskId: string | null;
  decidedOption: { optionId: string; label: string } | null;
  onDecide: (stepId: string, taskId: string, optionId: string, optionLabel: string) => void;
  ambiguityPickedLetter: string | null;
  onAmbiguityPick: (stepId: string, letter: string, taskId: string) => void;
}) {
  const decision = extractDecision(step.body);
  const explicitCode = extractExplicitCodeBlocks(step.body);

  let textSegments: ReturnType<typeof splitTextAndCode> = [];
  if (step.body && typeof step.body === "object") {
    const b = step.body as Record<string, unknown>;
    const primary =
      (typeof b.summary === "string" ? b.summary : "") ||
      (typeof b.description === "string" ? b.description : "") ||
      (typeof b.message === "string" ? b.message : "");
    if (primary) textSegments = splitTextAndCode(primary);
  }

  const hasStructured =
    decision !== null || explicitCode.length > 0 || textSegments.some((seg) => seg.kind === "code");

  // "handoff" is NEX1's reply to the user (meta_answer, small_talk, task
  // response). Render as a clean chat bubble · no actor chip, no timestamp,
  // no step_kind label, no raw JSON dump. Founder rule 2026-09-17.
  if (step.step_kind === "handoff" && !decision && explicitCode.length === 0 && !textSegments.some((s) => s.kind === "code")) {
    const b = (step.body ?? {}) as Record<string, unknown>;
    const replyText =
      (typeof b.reply === "string" ? b.reply : "") ||
      (typeof b.answer === "string" ? b.answer : "") ||
      (typeof b.message === "string" ? b.message : "") ||
      step.title ||
      "";
    // C7 phase 2 · founder rule 2026-09-17: when the handoff is an
    // ambiguity_clarification, render clickable option buttons directly under
    // the chat bubble so the founder resolves the ambiguity with ONE click
    // instead of typing "A"/"B"/etc. Buttons disable once picked.
    const isAmbiguity = b.kind === "ambiguity_clarification" && Array.isArray(b.options);
    const options = isAmbiguity ? (b.options as Array<{ id: string; slug: string; display: string; preview?: string }>) : [];
    return (
      <div className="naw-chat-msg naw-chat-msg--nex1" data-step-id={step.step_id}>
        <div className="naw-chat-msg-role">NEX1</div>
        <div className="naw-chat-msg-body">{replyText}</div>
        {isAmbiguity && activeTaskId && (
          <div className="naw-ambig-options">
            {options.map((opt) => {
              const isChosen = ambiguityPickedLetter === opt.id;
              const anyChosen = ambiguityPickedLetter !== null;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`naw-ambig-option ${isChosen ? "chosen" : ""}`}
                  disabled={anyChosen}
                  onClick={() => onAmbiguityPick(step.step_id, opt.id, activeTaskId)}
                  data-nex-ambig-option={opt.id}
                >
                  <span className="naw-ambig-letter">{opt.id}</span>
                  <span className="naw-ambig-display">{opt.display}</span>
                  {opt.preview && <span className="naw-ambig-preview">{opt.preview}</span>}
                  {isChosen && <span className="naw-ambig-chosen-mark">✓</span>}
                </button>
              );
            })}
            {ambiguityPickedLetter && (
              <div className="naw-ambig-chosen-banner">
                ✓ You picked {ambiguityPickedLetter} · NEX1 is planning now.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`naw-feed-step actor-${step.actor}`} data-step-id={step.step_id}>
      <div className="naw-feed-step-header">
        <span className={`naw-actor-chip actor-${step.actor}`} title={ACTOR_LABELS[step.actor]}>{ACTOR_INITIALS[step.actor]}</span>
        <span className={`naw-feed-step-actor actor-${step.actor}`}>{ACTOR_LABELS[step.actor]}</span>
        <span>· {step.step_kind}</span>
        <span style={{ marginLeft: "auto" }}>{new Date(step.created_at).toLocaleTimeString()}</span>
      </div>
      <div className="naw-feed-step-title">{step.title}</div>

      {decision && activeTaskId && (
        <div className="naw-decision">
          <div className="naw-decision-question">{decision.question}</div>
          <div className="naw-decision-options">
            {decision.options.map((opt) => {
              const isChosen = decidedOption?.optionId === opt.id;
              const anyChosen = decidedOption !== null;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`naw-decision-option ${opt.recommended ? "recommended" : ""} ${isChosen ? "selected" : ""}`}
                  disabled={anyChosen}
                  onClick={() => onDecide(step.step_id, activeTaskId, opt.id, opt.label)}
                >
                  <div className="naw-decision-option-label">
                    {opt.label}
                    {isChosen && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--naw-success)" }}>· chosen</span>}
                  </div>
                  {opt.description && <div className="naw-decision-option-description">{opt.description}</div>}
                </button>
              );
            })}
          </div>
          {decidedOption && (
            <div className="naw-decision-decided-banner">
              ✓ You chose: {decidedOption.label} · NEX1 will proceed at next checkpoint.
            </div>
          )}
        </div>
      )}

      {textSegments.map((seg, i) =>
        seg.kind === "code" ? (
          <CodeBlockView key={`t-code-${i}`} block={{ language: seg.language ?? "text", code: seg.text, note: null }} />
        ) : (
          <div key={`t-prose-${i}`} className="naw-step-prose">{seg.text}</div>
        ),
      )}

      {explicitCode.map((block, i) => (
        <CodeBlockView key={`ec-${i}`} block={block} />
      ))}

      {/* Raw body JSON fallback removed 2026-09-17 (founder rule): the Code
          feed is a chat surface · never dump internal pipeline metadata like
          `{entities,concept_id,confidence,...}` to the user. If a step has
          no summary/description/message and no structured content, the title
          alone tells the founder what happened. */}
    </div>
  );
}

function EditCodeEditor({
  taskId, task, onExit,
}: {
  taskId: string;
  task: Task | null;
  onExit: () => void;
}) {
  interface EditableFile { path: string; content: string; original: string; dirty: boolean; }
  const [files, setFiles] = useState<EditableFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [savingPath, setSavingPath] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading"); setSaveMsg(null);
      try {
        const planFiles: EditableFile[] = [];
        const plan = task?.plan as { proposed_files?: Array<{ path?: string; preview_content?: string }> } | null | undefined;
        if (plan?.proposed_files) {
          for (const pf of plan.proposed_files) {
            if (!pf?.path) continue;
            const content = String(pf.preview_content ?? "");
            planFiles.push({ path: pf.path, content, original: content, dirty: false });
          }
        }
        // Overlay any founder edits from the scratchpad
        try {
          const r = await fetch(`/api/nex/agent/edit-file?task_id=${encodeURIComponent(taskId)}`, { cache: "no-store" });
          const j = await r.json();
          if (j.ok && Array.isArray(j.files)) {
            for (const ed of j.files) {
              const existing = planFiles.find((f) => f.path === ed.path);
              if (existing) { existing.content = ed.content; existing.dirty = ed.content !== existing.original; }
              else planFiles.push({ path: ed.path, content: ed.content, original: "", dirty: ed.content.length > 0 });
            }
          }
        } catch { /* transient · continue with plan files only */ }
        if (cancelled) return;
        setFiles(planFiles);
        setActivePath(planFiles[0]?.path ?? null);
        setStatus("ready");
      } catch { if (!cancelled) setStatus("error"); }
    })();
    return () => { cancelled = true; };
  }, [taskId, task]);

  const activeFile = files.find((f) => f.path === activePath);

  const updateActiveContent = (content: string) => {
    if (!activePath) return;
    setFiles((prev) => prev.map((f) => f.path === activePath ? { ...f, content, dirty: content !== f.original } : f));
  };

  const saveActive = async () => {
    if (!activeFile) return;
    setSavingPath(activeFile.path); setSaveMsg(null);
    try {
      const r = await fetch("/api/nex/agent/edit-file", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task_id: taskId, path: activeFile.path, content: activeFile.content, edited_by: "founder" }),
      });
      const j = await r.json();
      if (j.ok) {
        setFiles((prev) => prev.map((f) => f.path === activeFile.path ? { ...f, original: f.content, dirty: false } : f));
        setSaveMsg(`saved ${activeFile.path} · ${j.size} bytes · re-apply the task to fold into the branch`);
        setTimeout(() => setSaveMsg(null), 4000);
      } else {
        setSaveMsg(`save failed: ${j.error ?? "unknown"}`);
      }
    } catch (e) { setSaveMsg(`save error: ${e instanceof Error ? e.message : "unknown"}`); }
    finally { setSavingPath(null); }
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0B1220", color: "#F9FAFB", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(148,163,184,0.18)", display: "flex", alignItems: "center", gap: 10 }}>
        <span className="naw-badge naw-badge-orange">EDITOR</span>
        <span style={{ fontSize: 12, color: "var(--naw-slate)" }}>
          Task <code>{taskId.slice(0, 8)}</code> · scratchpad · edits DO NOT touch the branch until you re-apply
        </span>
        <button type="button" className="naw-btn-secondary" onClick={onExit} style={{ marginLeft: "auto" }}>← Back to preview</button>
      </div>
      {status === "loading" && <div style={{ padding: 24, color: "var(--naw-slate)" }}>Loading files…</div>}
      {status === "error" && <div style={{ padding: 24, color: "var(--naw-danger)" }}>Failed to load task files</div>}
      {status === "ready" && (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "220px 1fr", minHeight: 0 }}>
          <aside style={{ borderRight: "1px solid rgba(148,163,184,0.18)", padding: 8, overflowY: "auto", background: "rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--naw-slate)", letterSpacing: "0.06em", marginBottom: 6, padding: "0 4px" }}>Files · {files.length}</div>
            {files.length === 0 ? (
              <div style={{ fontSize: 11, color: "var(--naw-slate)", padding: 8 }}>No proposed files on this task.</div>
            ) : files.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => setActivePath(f.path)}
                title={f.path}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "6px 8px", marginBottom: 2,
                  background: activePath === f.path ? "rgba(34,211,238,0.14)" : "transparent",
                  border: activePath === f.path ? "1px solid rgba(34,211,238,0.4)" : "1px solid transparent",
                  borderRadius: 5, cursor: "pointer",
                  color: activePath === f.path ? "var(--naw-cyan)" : "var(--naw-soft-white)",
                  fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                  wordBreak: "break-all",
                }}
              >
                {f.dirty && <span style={{ color: "var(--naw-warning)", marginRight: 4 }}>●</span>}
                {f.path.replace(/^src\//, "").replace(/\/[^/]+$/, "/")}
                <div style={{ fontSize: 10, color: "var(--naw-slate)", marginTop: 1 }}>{f.path.split("/").pop()}</div>
              </button>
            ))}
          </aside>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            {activeFile ? (
              <>
                <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(148,163,184,0.18)", display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
                  <code style={{ color: "var(--naw-cyan)", fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeFile.path}</code>
                  {activeFile.dirty && <span className="naw-badge naw-badge-amber">unsaved</span>}
                  <button
                    type="button"
                    className="naw-btn-primary"
                    onClick={saveActive}
                    disabled={!activeFile.dirty || savingPath === activeFile.path}
                    style={{ padding: "5px 12px", fontSize: 11, opacity: (!activeFile.dirty || savingPath === activeFile.path) ? 0.5 : 1 }}
                  >{savingPath === activeFile.path ? "Saving…" : "Save"}</button>
                </div>
                <textarea
                  value={activeFile.content}
                  onChange={(e) => updateActiveContent(e.target.value)}
                  spellCheck={false}
                  style={{
                    flex: 1, minHeight: 0, width: "100%", boxSizing: "border-box",
                    background: "rgba(0,0,0,0.35)", color: "#e2e8f0",
                    border: "none", padding: 12,
                    fontFamily: "'JetBrains Mono', Menlo, Consolas, monospace",
                    fontSize: 12, lineHeight: 1.55, resize: "none",
                    outline: "none",
                  }}
                />
                {saveMsg && (
                  <div style={{ padding: "6px 12px", background: "rgba(34,197,94,0.08)", borderTop: "1px solid rgba(34,197,94,0.28)", color: "var(--naw-success)", fontSize: 11 }}>{saveMsg}</div>
                )}
              </>
            ) : (
              <div style={{ padding: 24, color: "var(--naw-slate)", fontSize: 12 }}>Select a file on the left to edit.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PhoneCutoutOverlay({ cutout, screenW }: { cutout: CutoutSpec; screenW: number }) {
  const style: React.CSSProperties = {
    position: "absolute",
    top: cutout.top,
    width: cutout.width,
    height: cutout.height,
    borderRadius: cutout.borderRadius,
    // Red outline · founder-visible safe area · does NOT block iframe interactions
    border: "2px solid rgba(239, 68, 68, 0.85)",
    background: "rgba(239, 68, 68, 0.08)",
    boxShadow: "0 0 8px rgba(239, 68, 68, 0.5)",
    pointerEvents: "none",
    zIndex: 4,
  };
  if (cutout.centerX) {
    style.left = Math.max(0, (screenW - cutout.width) / 2);
  } else if (typeof cutout.left === "number") {
    style.left = cutout.left;
  }
  return (
    <div style={style} title={`Camera/notch area (${cutout.kind}) · your app content here is covered by the phone hardware`}>
      <span style={{
        position: "absolute",
        top: "100%", left: "50%", transform: "translate(-50%, 4px)",
        fontSize: 8, color: "rgb(239, 68, 68)", fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.08em",
        whiteSpace: "nowrap",
        textShadow: "0 0 4px rgba(0,0,0,0.9)",
      }}>◈ {cutout.kind.replace("-", " ")}</span>
    </div>
  );
}

function CodeBlockView({ block }: { block: StepCodeBlock }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(block.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch { /* clipboard unavailable · founder can still select-copy manually */ }
  };
  return (
    <div className="naw-code-block">
      <div className="naw-code-block-header">
        <span className="naw-code-block-lang">{block.language}</span>
        {block.note && <span className="naw-code-block-note">{block.note}</span>}
        <button
          type="button"
          className={`naw-code-block-copy ${copied ? "copied" : ""}`}
          onClick={copy}
          aria-label={`Copy ${block.language} code to clipboard`}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre>{block.code}</pre>
    </div>
  );
}
