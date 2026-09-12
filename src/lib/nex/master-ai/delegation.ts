// src/lib/nex/master-ai/delegation.ts
//
// NEX Master AI Engineer · Wave 4 · W4-C · Programmer delegation
// Philip 2026-09-07 · AUTHORIZE (Wave-4 continuous mission)
//
// Master AI can hand a legitimate, bounded engineering task to
// the Programmer core. This module is a LEDGER + boundary check —
// it does not execute Programmer code. The Programmer worker polls
// the ledger and picks up PENDING work.
//
// PRESERVATION:
//   · Bounds validated against Phase G contract (max_iterations 1..32,
//     max_runtime_ms 100..600000, max_files_changed 1..64).
//   · Task_slug MUST be non-empty and prefixed with the domain of
//     origin (e.g. "master_ai_research_prompt" · "connectivity_econ_model").
//   · Master AI never marks its own delegation COMPLETED · only the
//     recipient (Programmer) writes an outcome record.
//   · Never auto-promotes any outcome · promotions still route through
//     the AWAITING_APPROVAL queue in autonomous-evolution.ts.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { delegationLedgerPath } from "./paths";
import { validateBounds } from "./autonomous-evolution";
import type { AutonomousInvocationBounds, MasterAgentId } from "./types";

export type DelegationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "REJECTED"
  | "TIMED_OUT";

export type DelegationRecord = {
  delegation_id: string;
  created_at_iso: string;
  updated_at_iso: string;
  source_agent_id: MasterAgentId;                 // usually "master_ai"
  target_agent_id: MasterAgentId;                 // "programmer" for W4-C
  task_slug: string;                              // e.g. "connectivity_econ_model"
  task_description: string;
  bounds: AutonomousInvocationBounds;
  status: DelegationStatus;
  reason: string;
  outcome_ref: string | null;                     // optional pointer to result artifact
  outcome_notes: string | null;
};

export class InvalidDelegationError extends Error {
  constructor(reason: string) { super(`invalid_delegation:${reason}`); }
}

export function delegateTask(input: {
  source_agent_id: MasterAgentId;
  target_agent_id: MasterAgentId;
  task_slug: string;
  task_description: string;
  bounds: AutonomousInvocationBounds;
  reason: string;
}): DelegationRecord {
  if (!input.task_slug || input.task_slug.length < 3) throw new InvalidDelegationError("task_slug_too_short");
  if (!input.task_description || input.task_description.length < 5) throw new InvalidDelegationError("description_too_short");
  if (input.source_agent_id === input.target_agent_id) throw new InvalidDelegationError("self_delegation_not_allowed");
  validateBounds(input.bounds);

  const nowIso = new Date().toISOString();
  const rec: DelegationRecord = {
    delegation_id: randomUUID(),
    created_at_iso: nowIso,
    updated_at_iso: nowIso,
    status: "PENDING",
    outcome_ref: null,
    outcome_notes: null,
    ...input,
  };
  appendJsonLine(delegationLedgerPath(), rec);
  return rec;
}

/** Recipient acknowledges receipt. Master AI never calls this against
 *  its own delegation · Programmer calls it when it picks up the task. */
export function acceptDelegation(input: { delegation_id: string; recipient: MasterAgentId; reason: string }): DelegationRecord {
  return transition(input.delegation_id, "ACCEPTED", `${input.recipient}:${input.reason}`);
}

export function markInProgress(input: { delegation_id: string; recipient: MasterAgentId }): DelegationRecord {
  return transition(input.delegation_id, "IN_PROGRESS", `${input.recipient}:started`);
}

export function recordDelegationOutcome(input: {
  delegation_id: string;
  recipient: MasterAgentId;
  status: "COMPLETED" | "FAILED" | "REJECTED" | "TIMED_OUT";
  outcome_ref?: string | null;
  outcome_notes: string;
}): DelegationRecord {
  const rec = getDelegation(input.delegation_id);
  if (!rec) throw new InvalidDelegationError(`unknown_delegation:${input.delegation_id}`);
  const next: DelegationRecord = {
    ...rec,
    updated_at_iso: new Date().toISOString(),
    status: input.status,
    outcome_ref: input.outcome_ref ?? rec.outcome_ref,
    outcome_notes: `${input.recipient}:${input.outcome_notes}`,
  };
  appendJsonLine(delegationLedgerPath(), next);
  return next;
}

function transition(delegation_id: string, next_status: DelegationStatus, reason: string): DelegationRecord {
  const rec = getDelegation(delegation_id);
  if (!rec) throw new InvalidDelegationError(`unknown_delegation:${delegation_id}`);
  const next: DelegationRecord = { ...rec, status: next_status, reason, updated_at_iso: new Date().toISOString() };
  appendJsonLine(delegationLedgerPath(), next);
  return next;
}

export function readAllDelegations(): DelegationRecord[] {
  return readJsonlAll<DelegationRecord>(delegationLedgerPath());
}

export function getDelegation(delegation_id: string): DelegationRecord | null {
  let latest: DelegationRecord | null = null;
  for (const r of readAllDelegations()) if (r.delegation_id === delegation_id) latest = r;
  return latest;
}

export function listDelegations(filter?: { status?: DelegationStatus; target_agent_id?: MasterAgentId }): DelegationRecord[] {
  const byId = new Map<string, DelegationRecord>();
  for (const r of readAllDelegations()) byId.set(r.delegation_id, r);
  return Array.from(byId.values())
    .filter((r) => !filter?.status || r.status === filter.status)
    .filter((r) => !filter?.target_agent_id || r.target_agent_id === filter.target_agent_id);
}

// ─── Y-W4-3 · Consumer-side helpers (atomic claim + duplicate protection) ──

/** Returns the oldest PENDING delegation for the target agent that has
 *  not yet been claimed by anyone. Deterministic ordering by created_at. */
export function getNextClaimablePending(target_agent_id: MasterAgentId): DelegationRecord | null {
  const latestByDelId = new Map<string, DelegationRecord>();
  for (const r of readAllDelegations()) latestByDelId.set(r.delegation_id, r);
  const pendings = Array.from(latestByDelId.values())
    .filter((r) => r.target_agent_id === target_agent_id)
    .filter((r) => r.status === "PENDING")
    .sort((a, b) => a.created_at_iso.localeCompare(b.created_at_iso));
  return pendings[0] ?? null;
}

/** Atomic claim · appends ACCEPTED record with claimer_id embedded in reason.
 *  Verifies claim by re-reading state after append. Returns null if the
 *  delegation is no longer in PENDING state (race lost) or if verification
 *  fails. This is single-worker safe · multi-worker requires OS locking. */
export function atomicClaim(input: { delegation_id: string; claimer_id: string; recipient: MasterAgentId }): DelegationRecord | null {
  const current = getDelegation(input.delegation_id);
  if (!current) return null;
  if (current.status !== "PENDING") return null;    // race lost or already processed
  if (current.target_agent_id !== input.recipient) return null;
  const next: DelegationRecord = {
    ...current,
    status: "ACCEPTED",
    reason: `claimed_by:${input.recipient}:${input.claimer_id}`,
    updated_at_iso: new Date().toISOString(),
  };
  appendJsonLine(delegationLedgerPath(), next);
  const afterClaim = getDelegation(input.delegation_id);
  if (afterClaim?.reason !== next.reason) return null;   // some other appender won
  return next;
}

/** For restart-safety: find delegations that this claimer_id had ACCEPTED
 *  but never transitioned to IN_PROGRESS or beyond. These are orphaned
 *  claims (worker restarted mid-flow) and should be re-processed. */
export function orphanedClaimsFor(claimer_id: string, recipient: MasterAgentId): DelegationRecord[] {
  const latest = new Map<string, DelegationRecord>();
  for (const r of readAllDelegations()) latest.set(r.delegation_id, r);
  return Array.from(latest.values())
    .filter((r) => r.target_agent_id === recipient)
    .filter((r) => r.status === "ACCEPTED")
    .filter((r) => r.reason.includes(`claimed_by:${recipient}:${claimer_id}`));
}

export function _resetDelegationForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(delegationLedgerPath())) fs.unlinkSync(delegationLedgerPath()); } catch { /* ignore */ }
}
