// src/lib/nex/master-ai/autonomous-evolution.ts
//
// NEX Master AI Engineer · M11 · Bounded autonomous evolution
// Philip 2026-09-07 · AUTHORIZE
//
// PRESERVATION (load-bearing):
//   · Inherits Phase G execution bounds verbatim (max_iterations 1..32,
//     max_runtime_ms 100..600000, max_files_changed 1..64).
//   · Every candidate PROMOTED enters the founder approval queue.
//     Master AI NEVER auto-promotes.
//   · No `setInterval` inside Next.js process (§31). This module
//     provides the bounded invoker · external cadence drives it.
//   · Honours founder-stop-override sticky flag from agent-runtime.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { autonomousInvocationsPath, promotionApprovalQueuePath } from "./paths";
import { readFounderStopOverride } from "@/lib/nex/agent-runtime/registry";
import type {
  AutonomousInvocationRecord,
  AutonomousInvocationBounds,
  PromotionApprovalEntry,
  PromotionApprovalStatus,
  MasterAgentId,
} from "./types";

export class BoundsViolationError extends Error {
  constructor(field: string, value: number) { super(`bounds_violation:${field}=${value}`); }
}

export class FounderStopOverrideActiveError extends Error {
  constructor() { super("founder_stop_override_active"); }
}

/** Verify bounds match Phase G contract (src/lib/nex/programmer-execution
 *  /contract.ts). Fail closed. */
export function validateBounds(bounds: AutonomousInvocationBounds): void {
  if (bounds.max_iterations < 1 || bounds.max_iterations > 32) {
    throw new BoundsViolationError("max_iterations", bounds.max_iterations);
  }
  if (bounds.max_runtime_ms < 100 || bounds.max_runtime_ms > 10 * 60_000) {
    throw new BoundsViolationError("max_runtime_ms", bounds.max_runtime_ms);
  }
  if (bounds.max_files_changed < 1 || bounds.max_files_changed > 64) {
    throw new BoundsViolationError("max_files_changed", bounds.max_files_changed);
  }
}

/** Record a bounded autonomous invocation. Callers must have already
 *  bound their work — this module is a LEDGER, not an executor. Actual
 *  autonomous work delegates to Programmer Phase F/G modules. */
export function recordInvocation(input: {
  invoker_reason: string;
  bounds_applied: AutonomousInvocationBounds;
  candidates_produced: number;
  proposals_created: number;
  terminated_reason: string;
}): AutonomousInvocationRecord {
  validateBounds(input.bounds_applied);
  if (readFounderStopOverride().active) throw new FounderStopOverrideActiveError();

  // Any promotion decisions from Phase F are routed through the approval
  // queue — never auto-promoted. Master AI queues them; founder approves.
  const pending = listPromotionApprovalEntries({ status: "AWAITING_APPROVAL" }).length;

  const record: AutonomousInvocationRecord = {
    invocation_id: randomUUID(),
    invoked_at_iso: new Date().toISOString(),
    invoker_reason: input.invoker_reason,
    bounds_applied: input.bounds_applied,
    candidates_produced: input.candidates_produced,
    proposals_created: input.proposals_created,
    founder_approvals_pending: pending,
    terminated_reason: input.terminated_reason,
  };
  appendJsonLine(autonomousInvocationsPath(), record);
  return record;
}

export function readAllInvocations(): AutonomousInvocationRecord[] {
  return readJsonlAll<AutonomousInvocationRecord>(autonomousInvocationsPath());
}

// ─── Promotion Approval Queue ────────────────────────────────────────

export function queuePromotion(input: {
  proposal_id: string;
  capability_id: string;
  target_agent_id: MasterAgentId;
  reason: string;
}): PromotionApprovalEntry {
  const entry: PromotionApprovalEntry = {
    entry_id: randomUUID(),
    proposal_id: input.proposal_id,
    capability_id: input.capability_id,
    target_agent_id: input.target_agent_id,
    status: "AWAITING_APPROVAL",
    founder_user_id: null,
    reason: input.reason,
    created_at_iso: new Date().toISOString(),
    resolved_at_iso: null,
  };
  appendJsonLine(promotionApprovalQueuePath(), entry);
  return entry;
}

export function approvePromotion(input: {
  entry_id: string;
  founder_user_id: string;
  reason: string;
}): PromotionApprovalEntry {
  const current = getPromotionEntry(input.entry_id);
  if (!current) throw new Error(`unknown_promotion_entry:${input.entry_id}`);
  if (current.status !== "AWAITING_APPROVAL") throw new Error(`not_awaiting_approval:${current.status}`);
  const next: PromotionApprovalEntry = {
    ...current,
    status: "APPROVED",
    founder_user_id: input.founder_user_id,
    reason: input.reason,
    resolved_at_iso: new Date().toISOString(),
  };
  appendJsonLine(promotionApprovalQueuePath(), next);
  return next;
}

export function rejectPromotion(input: {
  entry_id: string;
  founder_user_id: string;
  reason: string;
}): PromotionApprovalEntry {
  const current = getPromotionEntry(input.entry_id);
  if (!current) throw new Error(`unknown_promotion_entry:${input.entry_id}`);
  const next: PromotionApprovalEntry = {
    ...current,
    status: "REJECTED",
    founder_user_id: input.founder_user_id,
    reason: input.reason,
    resolved_at_iso: new Date().toISOString(),
  };
  appendJsonLine(promotionApprovalQueuePath(), next);
  return next;
}

export function readAllPromotionEntries(): PromotionApprovalEntry[] {
  return readJsonlAll<PromotionApprovalEntry>(promotionApprovalQueuePath());
}

export function getPromotionEntry(entry_id: string): PromotionApprovalEntry | null {
  let latest: PromotionApprovalEntry | null = null;
  for (const e of readAllPromotionEntries()) if (e.entry_id === entry_id) latest = e;
  return latest;
}

export function listPromotionApprovalEntries(filter?: { status?: PromotionApprovalStatus }): PromotionApprovalEntry[] {
  const byId = new Map<string, PromotionApprovalEntry>();
  for (const e of readAllPromotionEntries()) byId.set(e.entry_id, e);
  return Array.from(byId.values())
    .filter((e) => !filter?.status || e.status === filter.status);
}

export function _resetAutonomousForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  for (const p of [autonomousInvocationsPath(), promotionApprovalQueuePath()]) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}
