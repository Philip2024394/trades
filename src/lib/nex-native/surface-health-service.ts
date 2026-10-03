// src/lib/nex-native/surface-health-service.ts
//
// Service boundary for nex_surface_health_event · implements §12 Item 1
// of the sealed Chat Surfaces × Visual Themes × HQ Diagnostics doctrine
// (2026-10-03).
//
// Scope (strict):
//   · recordFailure() — insert new row or dedup-update an existing
//     non-terminal row for the same failure_signature.
//   · transitionLifecycle() — admin lifecycle state transition with
//     legal-transition enforcement and verify-while-active guard.
//   · getFailureSignature() — pure derivation re-exported from
//     ./surface-health/signature so callers don't import deep paths.
//   · listNonTerminalBySignature() — query helper used by the
//     verify-while-active guard and future HQ surfaces.
//   · getById() — single-row lookup for admin audit.
//
// NOT in Item 1 scope (per §12):
//   · Any React error boundary. The boundaries are Item 2.
//   · Any HTTP route or API handler. The HQ page + kill-switch are
//     Item 3.
//   · Any client-side submission bridge. The route that accepts
//     client telemetry lands with Item 2 when the boundaries emit.
//
// Observability reuse (per audit · no parallel stack introduced):
//   · correlation_id via getCorrelationId() from
//     src/lib/nex/observability/correlation.ts
//   · structured logging via logger() from
//     src/lib/nex/observability/logger.ts
//   · Supabase service-role via nexSupabaseAdmin
//
// Content safety:
//   · recordFailure's input type does NOT accept any error message,
//     stack trace, body text or PII field. Only structured dimensions.
//   · state_history reasons are optional and short free text; callers
//     MUST NOT pass raw error strings or conversation content.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import { getCorrelationId } from "@/lib/nex/observability/correlation";
import { logger } from "@/lib/nex/observability/logger";
import {
  type ErrorClassification,
  type RecoveryAction,
  type ClientEnvironment,
  isErrorClassification,
  isRecoveryAction,
} from "./surface-health/classification";
import {
  deriveFailureSignature,
  type FailureSignatureInput,
} from "./surface-health/signature";
import {
  type LifecycleState,
  type StateHistoryEntry,
  LEGAL_TRANSITIONS,
  NON_TERMINAL_STATES,
  isLegalTransition,
  isTerminal,
} from "./surface-health/lifecycle";

export type { ErrorClassification, RecoveryAction, ClientEnvironment };
export type { LifecycleState, StateHistoryEntry };
export { deriveFailureSignature };

const log = logger("nex-native.surface-health");

// ─── Row type ───────────────────────────────────────────────────────

export interface NexSurfaceHealthEventRow {
  id: string;
  correlation_id: string | null;
  surface: string;
  visual_theme: string;
  component_module: string;
  occurred_at: string;
  error_classification: ErrorClassification;
  recovery_action: RecoveryAction;
  app_version: string | null;
  theme_version: string | null;
  client_environment: ClientEnvironment | null;
  failure_signature: string;
  lifecycle_state: LifecycleState;
  state_history: StateHistoryEntry[];
  occurrence_count: number;
  created_at: string;
  updated_at: string;
}

// ─── Public inputs ──────────────────────────────────────────────────

export interface RecordFailureInput {
  surface: string;
  visual_theme: string;
  component_module: string;
  error_classification: ErrorClassification;
  recovery_action: RecoveryAction;
  app_version?: string | null;
  theme_version?: string | null;
  client_environment?: ClientEnvironment | null;
  /** Optional explicit correlation_id. When omitted, the ambient ALS
   *  scope's correlation_id is used; when the ALS scope is absent,
   *  null is persisted (documented degradation · never synthesised). */
  correlation_id?: string | null;
}

// ─── Internal helpers ───────────────────────────────────────────────

/** The initial outcome state recorded for a fresh failure. We don't
 *  persist a transient `detected` row — the service treats detected
 *  as the implicit entry state and immediately records the outcome
 *  (recovered or fallback-active). The detected → outcome edge is
 *  preserved in state_history so audit is complete. */
function outcomeStateFor(action: RecoveryAction): LifecycleState {
  switch (action) {
    case "none":
      return "fallback-active";
    case "fallback":
      return "fallback-active";
    case "retry":
      return "recovered";
    case "degrade":
      return "fallback-active";
    default:
      // Unreachable with current closed set; defensive fallback.
      return "fallback-active";
  }
}

function initialHistory(
  outcome: LifecycleState,
  reason: string | null,
): StateHistoryEntry[] {
  const at = new Date().toISOString();
  return [
    { from: null, to: "detected", at, reason: null },
    { from: "detected", to: outcome, at, reason },
  ];
}

function assertSafeReason(reason: string | null | undefined): string | null {
  if (reason == null) return null;
  // Guard: service-layer defense against callers passing raw error text.
  // Reasons are short admin-authored labels, not error payloads.
  if (reason.length > 240) {
    throw new Error(
      "surface-health-service: reason exceeds 240 chars · raw error text or conversation content is forbidden",
    );
  }
  return reason;
}

// ─── Public API ─────────────────────────────────────────────────────

/** Record a surface/theme failure. Dedups against any existing
 *  non-terminal row with the same failure_signature — on dedup hit,
 *  bumps occurrence_count and appends a history entry; on dedup
 *  miss, inserts a new row with lifecycle_state set to the outcome
 *  implied by recovery_action.
 *
 *  No conversation content or raw error text may be passed. The input
 *  type enforces this at compile time. */
export async function recordFailure(
  input: RecordFailureInput,
): Promise<NexSurfaceHealthEventRow> {
  if (!isErrorClassification(input.error_classification)) {
    throw new Error(
      `surface-health-service.recordFailure: unknown error_classification ${String(input.error_classification)}`,
    );
  }
  if (!isRecoveryAction(input.recovery_action)) {
    throw new Error(
      `surface-health-service.recordFailure: unknown recovery_action ${String(input.recovery_action)}`,
    );
  }

  const sigInput: FailureSignatureInput = {
    surface: input.surface,
    visual_theme: input.visual_theme,
    component_module: input.component_module,
    error_classification: input.error_classification,
    app_version: input.app_version ?? null,
    theme_version: input.theme_version ?? null,
  };
  const signature = deriveFailureSignature(sigInput);
  const outcome = outcomeStateFor(input.recovery_action);
  const correlation_id =
    input.correlation_id === undefined
      ? getCorrelationId()
      : input.correlation_id;

  const existing = await findNonTerminalBySignature(signature);
  if (existing) {
    const now = new Date().toISOString();
    const nextHistory: StateHistoryEntry[] = [
      ...existing.state_history,
      {
        from: existing.lifecycle_state,
        to: existing.lifecycle_state,
        at: now,
        reason: "dedup_occurrence",
      },
    ];
    const { data, error } = await nexSupabaseAdmin
      .from("nex_surface_health_event")
      .update({
        occurrence_count: existing.occurrence_count + 1,
        occurred_at: now,
        state_history: nextHistory,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(
        `surface-health-service.recordFailure(dedup): ${error?.message ?? "no row returned"}`,
      );
    }
    log.info("dedup_occurrence", {
      signature,
      row_id: existing.id,
      occurrence_count: existing.occurrence_count + 1,
      lifecycle_state: existing.lifecycle_state,
    });
    return data as NexSurfaceHealthEventRow;
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_surface_health_event")
    .insert({
      correlation_id,
      surface: input.surface,
      visual_theme: input.visual_theme,
      component_module: input.component_module,
      error_classification: input.error_classification,
      recovery_action: input.recovery_action,
      app_version: input.app_version ?? null,
      theme_version: input.theme_version ?? null,
      client_environment: input.client_environment ?? null,
      failure_signature: signature,
      lifecycle_state: outcome,
      state_history: initialHistory(outcome, null),
      occurrence_count: 1,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `surface-health-service.recordFailure(insert): ${error?.message ?? "no row returned"}`,
    );
  }
  log.info("new_incident", {
    signature,
    row_id: (data as NexSurfaceHealthEventRow).id,
    lifecycle_state: outcome,
    surface: input.surface,
    visual_theme: input.visual_theme,
    component_module: input.component_module,
    error_classification: input.error_classification,
    recovery_action: input.recovery_action,
  });
  return data as NexSurfaceHealthEventRow;
}

/** Admin lifecycle transition. Legal-transition set is enforced here
 *  AND by the DB trigger; the verify-while-active guard is enforced
 *  here (preflight) and by the DB trigger (last line of defense).
 *
 *  Returns the updated row. Throws on illegal transition, on terminal-
 *  state transition attempt, or on verify-while-active conflict. */
export async function transitionLifecycle(
  id: string,
  nextState: LifecycleState,
  reason?: string | null,
): Promise<NexSurfaceHealthEventRow> {
  const safeReason = assertSafeReason(reason);
  const current = await getById(id);
  if (!current) {
    throw new Error(`surface-health-service.transitionLifecycle: row ${id} not found`);
  }
  if (isTerminal(current.lifecycle_state)) {
    throw new Error(
      `surface-health-service.transitionLifecycle: ${current.lifecycle_state} is terminal`,
    );
  }
  if (!isLegalTransition(current.lifecycle_state, nextState)) {
    const legal = LEGAL_TRANSITIONS[current.lifecycle_state].join(", ") || "(none)";
    throw new Error(
      `surface-health-service.transitionLifecycle: illegal ${current.lifecycle_state} → ${nextState} · legal next: ${legal}`,
    );
  }

  if (nextState === "verified") {
    const conflicts = await listNonTerminalBySignature(current.failure_signature);
    const blocking = conflicts.filter(
      (r) =>
        r.id !== id &&
        (r.lifecycle_state === "fallback-active" || r.lifecycle_state === "ongoing"),
    );
    if (blocking.length > 0) {
      throw new Error(
        `surface-health-service.transitionLifecycle: cannot verify while ${blocking.length} row(s) with signature ${current.failure_signature} remain in fallback-active or ongoing`,
      );
    }
  }

  const now = new Date().toISOString();
  const nextHistory: StateHistoryEntry[] = [
    ...current.state_history,
    {
      from: current.lifecycle_state,
      to: nextState,
      at: now,
      reason: safeReason,
    },
  ];

  const { data, error } = await nexSupabaseAdmin
    .from("nex_surface_health_event")
    .update({
      lifecycle_state: nextState,
      state_history: nextHistory,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `surface-health-service.transitionLifecycle: ${error?.message ?? "no row returned"}`,
    );
  }
  log.info("lifecycle_transition", {
    row_id: id,
    from: current.lifecycle_state,
    to: nextState,
    signature: current.failure_signature,
    reason: safeReason,
  });
  return data as NexSurfaceHealthEventRow;
}

/** Fetch one row by id. */
export async function getById(
  id: string,
): Promise<NexSurfaceHealthEventRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_surface_health_event")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`surface-health-service.getById: ${error.message}`);
  }
  return (data as NexSurfaceHealthEventRow | null) ?? null;
}

/** All rows for a given failure_signature in a non-terminal state.
 *  Used by recordFailure for dedup, by transitionLifecycle for the
 *  verify-while-active guard, and (future) by HQ for incident
 *  grouping. */
export async function listNonTerminalBySignature(
  failure_signature: string,
): Promise<NexSurfaceHealthEventRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_surface_health_event")
    .select("*")
    .eq("failure_signature", failure_signature)
    .in("lifecycle_state", NON_TERMINAL_STATES as readonly LifecycleState[])
    .order("occurred_at", { ascending: false });
  if (error) {
    throw new Error(
      `surface-health-service.listNonTerminalBySignature: ${error.message}`,
    );
  }
  return (data as NexSurfaceHealthEventRow[] | null) ?? [];
}

async function findNonTerminalBySignature(
  failure_signature: string,
): Promise<NexSurfaceHealthEventRow | null> {
  const rows = await listNonTerminalBySignature(failure_signature);
  // Return the most recently occurred non-terminal row (ordered desc
  // in the query above). In normal operation there should be at most
  // one per signature; if more exist (e.g. a concurrent insert race),
  // the newest wins and the older rows will naturally close out via
  // admin transition.
  return rows[0] ?? null;
}
