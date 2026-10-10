// src/lib/nex-agent/code-engine/capability-workstation-preview-state.ts
//
// NEX1 · Workstation Preview State Machine (Ledger B additive · Zero LLM)
// Founder-authorised 2026-09-19 as part of Full Product Build Mandate §13-17.
//
// PURPOSE
//   Convert raw preview-status HTTP probe evidence + build/runtime signals
//   into the 8 distinguishable preview states required by founder §15:
//     STARTING · BUILDING · RUNNING · READY · RUNTIME_ERROR · BUILD_ERROR · STOPPED · NO_PREVIEW
//
//   The existing `/api/nex1/workstation-live/preview-status` endpoint returns
//   only `reachable: boolean` + http_status. That is 2 effective states.
//   This module upgrades that signal to the 8-state distinction by consuming:
//     1. HTTP probe result (from existing preview-status endpoint)
//     2. Optional build-log evidence (from a coding-loop's build stage)
//     3. Optional runtime error signals (from browser-side error capture · future)
//     4. Explicit lifecycle events (dev-server started/stopped)
//
// FOUNDER PRINCIPLE (verbatim §17)
//   "The preview is evidence. It is not merely decoration."
//
// INVARIANTS
//   · Additive · never modifies frozen files
//   · Zero LLM
//   · Deterministic · same input → same state
//   · Every state has a rationale string
//   · Anti-fabrication: NEVER returns READY without evidence

import { createHash } from "node:crypto";

export const WORKSTATION_PREVIEW_STATE_VERSION = "workstation-preview-state.v1.2026-09-19";

export type PreviewState =
  | "NO_PREVIEW"      // No dev server has been started or preview target set
  | "STARTING"        // Dev server process launched · not yet responding
  | "BUILDING"        // Server responding with build-in-progress indicator (or first-request compile)
  | "RUNNING"         // Server up · not yet reached target route
  | "READY"           // Target route returns 2xx · content received
  | "RUNTIME_ERROR"   // Route returned 5xx OR reported runtime exception
  | "BUILD_ERROR"     // Build failed · error page or 500-with-stack observed
  | "STOPPED";        // Dev server was started then explicitly stopped or crashed

export interface PreviewProbeInput {
  /** Reachable per HTTP probe (from existing preview-status endpoint). */
  readonly probe_reachable: boolean | null;
  /** HTTP status returned by probe · null if no response. */
  readonly probe_http_status: number | null;
  /** Duration of probe request in ms. Used to detect first-compile latency. */
  readonly probe_duration_ms: number | null;
  /** Non-null reason string from the probe (e.g., "timeout", "fetch_error:..."). */
  readonly probe_reason: string | null;
  /** Explicit dev-server lifecycle if known: "not_started" | "started" | "stopped" | "crashed" | null (unknown). */
  readonly server_lifecycle: "not_started" | "started" | "stopped" | "crashed" | null;
  /** Optional build stage summary from a coding-loop (verdict + evidence lines). */
  readonly build_stage_verdict: "PENDING" | "RUNNING" | "VERIFIED" | "FAILED" | null;
  /** Optional runtime error signal captured from the app · null if none seen. */
  readonly runtime_error_seen: boolean | null;
  /** Optional: last observed preview URL. Used for deterministic input digest. */
  readonly target_url: string | null;
  /** Optional: iso timestamp of the last probe. */
  readonly probed_at_iso: string | null;
}

export interface PreviewStateAssessment {
  readonly state: PreviewState;
  readonly rationale: string;
  readonly evidence_signals: readonly string[];
  readonly ambiguity_flags: readonly string[];
  readonly caller_should_display: {
    readonly user_facing_label: string;
    readonly is_error_state: boolean;
    readonly is_terminal_state: boolean;
    readonly show_retry_button: boolean;
  };
  readonly input_digest: string;
  readonly assessed_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

// ── Deterministic state machine ──────────────────────────────────────────

export function assessPreviewState(input: PreviewProbeInput): PreviewStateAssessment {
  const signals: string[] = [];
  const ambiguity: string[] = [];

  if (input.probe_reachable !== null) signals.push(`probe_reachable=${input.probe_reachable}`);
  if (input.probe_http_status !== null) signals.push(`http_status=${input.probe_http_status}`);
  if (input.probe_reason !== null) signals.push(`probe_reason=${input.probe_reason}`);
  if (input.server_lifecycle !== null) signals.push(`server_lifecycle=${input.server_lifecycle}`);
  if (input.build_stage_verdict !== null) signals.push(`build_stage=${input.build_stage_verdict}`);
  if (input.runtime_error_seen !== null) signals.push(`runtime_error_seen=${input.runtime_error_seen}`);

  let state: PreviewState;
  let rationale: string;

  // Ordered predicates · every branch has a concrete evidence signal
  if (input.server_lifecycle === "not_started" && input.probe_reachable !== true) {
    state = "NO_PREVIEW";
    rationale = "server_lifecycle=not_started and probe never observed a reachable server";
  } else if (input.server_lifecycle === "stopped" || input.server_lifecycle === "crashed") {
    state = "STOPPED";
    rationale = `server_lifecycle=${input.server_lifecycle}`;
  } else if (input.build_stage_verdict === "FAILED") {
    state = "BUILD_ERROR";
    rationale = "build_stage_verdict=FAILED · build did not produce a runnable artifact";
  } else if (input.build_stage_verdict === "RUNNING") {
    state = "BUILDING";
    rationale = "build_stage_verdict=RUNNING · build in progress";
  } else if (input.runtime_error_seen === true) {
    state = "RUNTIME_ERROR";
    rationale = "runtime_error_seen=true · app rendered but reported a runtime exception";
  } else if (input.probe_reachable === true && input.probe_http_status !== null) {
    // Distinguish READY vs RUNTIME_ERROR based on HTTP status
    if (input.probe_http_status >= 500) {
      state = "RUNTIME_ERROR";
      rationale = `http_status=${input.probe_http_status} · server responded with 5xx`;
    } else if (input.probe_http_status >= 200 && input.probe_http_status < 400) {
      state = "READY";
      rationale = `probe_reachable=true and http_status=${input.probe_http_status} · target route served content`;
    } else {
      // 4xx: reachable but route not found → RUNNING (server up · route missing)
      state = "RUNNING";
      rationale = `http_status=${input.probe_http_status} · server up but target route returned 4xx`;
      ambiguity.push("route_may_not_exist");
    }
  } else if (input.server_lifecycle === "started" && input.probe_reachable !== true) {
    // Server just started · not yet responding
    state = "STARTING";
    rationale = "server_lifecycle=started and probe not yet reachable · dev server initializing";
  } else if (input.probe_reason === "timeout") {
    state = "BUILDING";
    rationale = "probe timed out · first-request compile latency likely";
    ambiguity.push("timeout_could_also_mean_server_hang");
  } else if (input.probe_reachable === false && input.probe_reason !== null) {
    // Server unreachable with a specific reason
    state = "NO_PREVIEW";
    rationale = `probe_reachable=false · reason=${input.probe_reason}`;
  } else {
    state = "NO_PREVIEW";
    rationale = "insufficient evidence · no probe result, no lifecycle signal";
    ambiguity.push("no_evidence_gathered");
  }

  const is_error_state = state === "RUNTIME_ERROR" || state === "BUILD_ERROR";
  const is_terminal_state = state === "STOPPED" || state === "BUILD_ERROR";
  const show_retry_button = state === "RUNTIME_ERROR" || state === "BUILD_ERROR" || state === "STOPPED" || state === "NO_PREVIEW";

  const input_digest = createHash("sha256")
    .update(JSON.stringify({
      probe_reachable: input.probe_reachable,
      probe_http_status: input.probe_http_status,
      probe_reason: input.probe_reason,
      server_lifecycle: input.server_lifecycle,
      build_stage_verdict: input.build_stage_verdict,
      runtime_error_seen: input.runtime_error_seen,
      target_url: input.target_url,
    }))
    .digest("hex")
    .slice(0, 16);

  return {
    state,
    rationale,
    evidence_signals: signals,
    ambiguity_flags: ambiguity,
    caller_should_display: {
      user_facing_label: userFacingLabelFor(state),
      is_error_state,
      is_terminal_state,
      show_retry_button,
    },
    input_digest,
    assessed_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
    version: WORKSTATION_PREVIEW_STATE_VERSION,
  };
}

function userFacingLabelFor(state: PreviewState): string {
  switch (state) {
    case "NO_PREVIEW": return "No preview yet";
    case "STARTING": return "Starting…";
    case "BUILDING": return "Building…";
    case "RUNNING": return "Server up · loading target route";
    case "READY": return "Ready";
    case "RUNTIME_ERROR": return "Runtime error";
    case "BUILD_ERROR": return "Build failed";
    case "STOPPED": return "Preview stopped";
  }
}

// ── Viewport presets (founder §14 · desktop + tablet + phone) ────────────
//
// Ledger B structure · dimensions are canonical CSS-pixel viewports.
// The existing NexPreviewShell.tsx has phone presets only (iPhone 390/393/402
// · Android 360). This exports the missing DESKTOP and TABLET presets in
// canonical form so callers can extend the shell additively.

export const CANONICAL_VIEWPORT_PRESETS = Object.freeze([
  { id: "desktop-1440",  label: "Desktop 1440 × 900",  w: 1440, h: 900,  category: "desktop" as const },
  { id: "desktop-1920",  label: "Desktop 1920 × 1080", w: 1920, h: 1080, category: "desktop" as const },
  { id: "tablet-1024",   label: "Tablet 1024 × 768",   w: 1024, h: 768,  category: "tablet"  as const },
  { id: "tablet-810",    label: "iPad 810 × 1080",     w: 810,  h: 1080, category: "tablet"  as const },
  { id: "phone-390",     label: "iPhone 390 × 844",    w: 390,  h: 844,  category: "phone"   as const },
  { id: "phone-393",     label: "iPhone 393 × 852",    w: 393,  h: 852,  category: "phone"   as const },
  { id: "phone-360",     label: "Android 360 × 800",   w: 360,  h: 800,  category: "phone"   as const },
]);

export type ViewportCategory = "desktop" | "tablet" | "phone";

export function viewportsByCategory(category: ViewportCategory): typeof CANONICAL_VIEWPORT_PRESETS {
  return CANONICAL_VIEWPORT_PRESETS.filter((p) => p.category === category) as unknown as typeof CANONICAL_VIEWPORT_PRESETS;
}

// ── Evidence emission for coding-loop episode receipts ───────────────────
//
// When a coding attempt produces a preview, the wrapper's episode receipt
// can absorb this preview evidence. This helper builds the observed layer.

export interface PreviewEpisodeEvidence {
  readonly preview_state: PreviewState;
  readonly preview_rationale: string;
  readonly preview_target_url: string | null;
  readonly preview_http_status: number | null;
  readonly evidence_kind: "OBSERVED_PREVIEW_STATE";
  readonly caller_must_decide: true;
}

export function toEpisodeEvidence(
  assessment: PreviewStateAssessment,
  target_url: string | null,
  http_status: number | null,
): PreviewEpisodeEvidence {
  return {
    preview_state: assessment.state,
    preview_rationale: assessment.rationale,
    preview_target_url: target_url,
    preview_http_status: http_status,
    evidence_kind: "OBSERVED_PREVIEW_STATE",
    caller_must_decide: true,
  };
}
