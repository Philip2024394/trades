// src/lib/nex-hq/workforce-status.ts
//
// NEX Workforce Status vocabulary (2026-08-24).
//
// Composes a LIVE indicator per (city, category) from three real inputs:
//   1. Rotation state row (build/saturated/maintenance/reactivate + zero-streak + last cycle)
//   2. In-flight cycle rows (worker_cycle_run · status='running')
//   3. Orchestrator queue (would-pick + eligible + waiting-cooldown + gated)
//
// Doctrine (Philip 2026-08-24):
//   · "Do NOT call something 'finished'. A discovery area is NEVER permanently finished."
//   · "SATURATED means temporarily exhausted · the Rotation Controller can later return to it."
//   · "Every indicator must come from real DB state. Never fake a green dot."
//   · Fine-grained vocabulary avoids the earlier binary green/red trap.

export type WorkforceStatus =
  | "working"        // 🟢 walker cycle currently running for this combo
  | "queued"         // 🔵 orchestrator's next would-pick
  | "waiting"        // 🟡 eligible but waiting for slot / cooldown / provider
  | "idle"           // ⚪ available for work but not currently executing or queued
  | "saturated"      // 🔴 completed cycles produced no new records repeatedly · will be revisited
  | "error"          // 🟠 last cycle failed
  | "unavailable";   // ⚫ walker not city-configurable · provider unavailable

export const WORKFORCE_STATUS_META: Record<WorkforceStatus, { dot: string; label: string; bg: string; fg: string; border: string }> = {
  working:     { dot: "🟢", label: "Working",     bg: "rgba(16,185,129,0.10)", fg: "#047857", border: "rgba(16,185,129,0.35)" },
  queued:      { dot: "🔵", label: "Queued",      bg: "rgba(37,99,235,0.10)",  fg: "#1e40af", border: "rgba(37,99,235,0.35)" },
  waiting:     { dot: "🟡", label: "Waiting",     bg: "rgba(245,158,11,0.10)", fg: "#92400e", border: "rgba(245,158,11,0.35)" },
  idle:        { dot: "⚪", label: "Idle",        bg: "rgba(0,0,0,0.03)",       fg: "#525252", border: "rgba(0,0,0,0.15)" },
  saturated:   { dot: "🔴", label: "Saturated",   bg: "rgba(220,38,38,0.06)",  fg: "#991b1b", border: "rgba(220,38,38,0.30)" },
  error:       { dot: "🟠", label: "Error",       bg: "rgba(249,115,22,0.10)", fg: "#9a3412", border: "rgba(249,115,22,0.35)" },
  unavailable: { dot: "⚫", label: "Unavailable", bg: "rgba(0,0,0,0.02)",       fg: "#737373", border: "rgba(0,0,0,0.10)" },
};

// ── Input types ──────────────────────────────────────────────────────────

export interface WorkforceStatusInput {
  city: string;
  category: string;
  walkerAvailable: boolean;
  rotationState: "build" | "saturated" | "maintenance" | "reactivate" | null;
  lastCycleStatus: "completed" | "failed" | "running" | null;   // most recent cycle terminal status
  consecutiveZeroNewCycles: number;
  inFlight: boolean;                       // any cycle currently 'running'
  isQueued: boolean;                       // orchestrator's would-pick
  isEligible: boolean;                     // orchestrator's eligible (not queued)
  isWaitingCooldown: boolean;              // fairness/backoff
  isGatedProvider: boolean;                // provider unavailable
}

// ── Pure resolver (single call · deterministic) ─────────────────────────

/**
 * Resolve the workforce status per (city, category) from all real signals.
 * Precedence (highest wins):
 *   unavailable > working > queued > waiting > gated > saturated > error > idle
 *
 * The precedence favours ACTIVE + AUTHORITATIVE signals: if the walker is
 * currently working, that trumps whatever the rotation state says. If the
 * combo is unavailable at all, nothing else matters.
 */
export function resolveWorkforceStatus(input: WorkforceStatusInput): WorkforceStatus {
  if (!input.walkerAvailable) return "unavailable";
  if (input.inFlight) return "working";
  if (input.isQueued) return "queued";
  if (input.isGatedProvider) return "waiting";
  if (input.isWaitingCooldown) return "waiting";
  if (input.rotationState === "saturated") return "saturated";
  if (input.lastCycleStatus === "failed") return "error";
  if (input.isEligible) return "idle";
  // Default: rotation state says build but the picker didn't surface it this
  // tick (no in-flight, no queue) · treat as idle rather than fabricating queued.
  return "idle";
}
