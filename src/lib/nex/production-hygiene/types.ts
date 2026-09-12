// src/lib/nex/production-hygiene/types.ts
//
// WAVE-P-4 · GAP-8 · GAP-9 · GAP-10 · GAP-12 · production hygiene primitives
// Founder BEGIN WAVE-P-4 · 2026-09-08
//
// Four primitives · one module directory:
//   · Checkpointing (adaptive MAX_STEPS + resumable state) — GAP-8
//   · Streaming reconnection (SSE Last-Event-ID) — GAP-9
//   · Delegation timeout reaper — GAP-10
//   · HITL breakpoints as first-class runtime primitive — GAP-12

// ═══════════════════════════════════════════════════════════════════
// § A · CHECKPOINTING (GAP-8)
// ═══════════════════════════════════════════════════════════════════

export type StepCheckpoint = {
  run_id: string;
  step_number: number;
  step_id: string;
  step_kind: "message" | "tool_call" | "tool_result" | "reasoning" | "summary" | "await_hitl";
  captured_at_iso: string;
  serialized_state: string;        // opaque JSON · caller-defined
  parent_step_id?: string;
};

export type RunCheckpointHeader = {
  run_id: string;
  started_at_iso: string;
  last_step_at_iso: string;
  total_steps: number;
  max_steps_budget: number;
  budget_remaining: number;
  status: "active" | "completed" | "abandoned" | "awaiting_hitl";
};

export type AdaptiveBudgetDecision =
  | { action: "continue"; steps_remaining: number }
  | { action: "expand_budget"; new_budget: number; reason: string }
  | { action: "await_hitl"; reason: string }
  | { action: "abandon"; reason: string };

// ═══════════════════════════════════════════════════════════════════
// § B · STREAMING RECONNECTION (GAP-9)
// ═══════════════════════════════════════════════════════════════════

export type SseEvent = {
  event_id: string;                // increments monotonically per stream
  event_type: string;
  data: string;                    // JSON-serialized payload
  ts_iso: string;
};

export type ReconnectRequest = {
  last_event_id?: string;          // client's high-water mark
  session_id: string;
};

export type ReplayResult = {
  session_id: string;
  events_replayed: readonly SseEvent[];
  first_new_event_id: string | null;
  session_expired: boolean;
};

// ═══════════════════════════════════════════════════════════════════
// § C · DELEGATION TIMEOUT REAPER (GAP-10)
// ═══════════════════════════════════════════════════════════════════

export type DelegationLike = {
  delegation_id: string;
  status: "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "REJECTED" | "TIMED_OUT";
  created_at_iso: string;
  accepted_at_iso?: string;
  deadline_iso?: string;           // explicit deadline · reaper honors first
};

export type ReaperConfig = {
  /** Default max age for PENDING before auto-fail. */
  pending_max_age_ms: number;
  /** Default max age for IN_PROGRESS before auto-fail. */
  in_progress_max_age_ms: number;
};

export const DEFAULT_REAPER_CONFIG: ReaperConfig = {
  pending_max_age_ms: 60 * 60 * 1000,      // 1 hour
  in_progress_max_age_ms: 4 * 60 * 60 * 1000, // 4 hours
};

export type ReaperDecision =
  | { delegation_id: string; action: "keep" }
  | { delegation_id: string; action: "timeout"; reason: string; age_ms: number };

// ═══════════════════════════════════════════════════════════════════
// § D · HITL BREAKPOINTS (GAP-12)
// ═══════════════════════════════════════════════════════════════════

export type BreakpointReason =
  | "approval_required"
  | "budget_exceeded"
  | "high_risk_tool"
  | "founder_gate"
  | "adversarial_signal"
  | "custom";

export type BreakpointRequest = {
  breakpoint_id: string;
  run_id: string;
  step_id: string;
  reason: BreakpointReason;
  prompt_to_founder: string;       // human-readable request
  pending_action_summary: string;
  requested_at_iso: string;
  metadata?: Record<string, unknown>;
};

export type BreakpointResolution =
  | { breakpoint_id: string; decision: "approve"; approved_by: string; resolved_at_iso: string; notes?: string }
  | { breakpoint_id: string; decision: "reject"; rejected_by: string; resolved_at_iso: string; reason: string }
  | { breakpoint_id: string; decision: "modify"; modifier: string; resolved_at_iso: string; modified_action: unknown; notes?: string };

export type BreakpointState =
  | { kind: "awaiting"; request: BreakpointRequest }
  | { kind: "resolved"; request: BreakpointRequest; resolution: BreakpointResolution };
