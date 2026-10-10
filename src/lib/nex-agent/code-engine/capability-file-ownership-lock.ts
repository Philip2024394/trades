// src/lib/nex-agent/code-engine/capability-file-ownership-lock.ts
//
// NEX1 · File Ownership Lock · Founder new rule (2026-09-19):
//
// "nex twin also with large files can help nex1 with codeing but never will
//  both nex1 and nextwin code the exact same file at same time or if nex1
//  has completed file code · nex twin does not require to code it again"
//
// Ledger B additive · Zero LLM · Deterministic · JSONL persistence.
//
// SEMANTICS
//   Files transition through:
//     UNCLAIMED → CLAIMED_BY_<AGENT> → RELEASED (returns to UNCLAIMED)
//                                  ↓
//                            COMPLETED_BY_<AGENT> (Twin skips)
//
// INVARIANTS
//   · A file can have AT MOST ONE claim at any time
//   · claim() is atomic · returns FAILED if already claimed by another agent
//   · Twin agents check should_process() first · skip COMPLETED_BY_NEX1 files
//   · Completion is durable · survives session · retained until explicit reopen
//   · Zero LLM · deterministic

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const FILE_OWNERSHIP_LOCK_VERSION = "file-ownership-lock.v1.2026-09-19";

// ── State machine ────────────────────────────────────────────────────────

export type FileState =
  | "UNCLAIMED"
  | "CLAIMED"
  | "COMPLETED";

export type Agent = "NEX1" | "TwinNEX" | (string & {});

export interface FileLock {
  readonly file_path: string;   // normalized relative path
  readonly state: FileState;
  readonly claimed_by: Agent | null;
  readonly claimed_at_iso: string | null;
  readonly claimed_session_id: string | null;
  readonly claim_purpose: string | null;
  readonly completed_by: Agent | null;
  readonly completed_at_iso: string | null;
  readonly last_transition_iso: string;
}

export interface FileLockOptions {
  readonly data_root: string;
  readonly project_id: string;
}

function locksPath(opts: FileLockOptions): string {
  return path.join(opts.data_root, "projects", opts.project_id, "file-ownership.jsonl");
}

// ── Load current state (last-transition wins per file) ──────────────────

export function loadFileLocks(opts: FileLockOptions): Record<string, FileLock> {
  const p = locksPath(opts);
  if (!existsSync(p)) return {};
  const state: Record<string, FileLock> = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const rec = JSON.parse(trimmed) as FileLock;
      state[normalizePath(rec.file_path)] = { ...rec, file_path: normalizePath(rec.file_path) };
    } catch { /* skip */ }
  }
  return state;
}

// ── Claim ────────────────────────────────────────────────────────────────

export interface ClaimResult {
  readonly ok: boolean;
  readonly state: FileState;
  readonly claimed_by: Agent | null;
  readonly refusal_reason: string | null;
  readonly evidence_signals: readonly string[];
}

export function claimFile(
  file_path: string,
  agent: Agent,
  session_id: string,
  purpose: string,
  opts: FileLockOptions,
): ClaimResult {
  const norm = normalizePath(file_path);
  const state = loadFileLocks(opts);
  const current = state[norm];
  const signals: string[] = [`file=${norm}`, `agent=${agent}`];

  // Rule 1: if already COMPLETED, cannot claim
  if (current?.state === "COMPLETED") {
    signals.push(`current_state=COMPLETED_by=${current.completed_by}`);
    return {
      ok: false,
      state: "COMPLETED",
      claimed_by: current.completed_by,
      refusal_reason: `already_completed_by:${current.completed_by} · agent should not process again`,
      evidence_signals: signals,
    };
  }

  // Rule 2: if currently CLAIMED by a different agent, cannot claim
  if (current?.state === "CLAIMED" && current.claimed_by !== agent) {
    signals.push(`current_state=CLAIMED_by=${current.claimed_by}`);
    return {
      ok: false,
      state: "CLAIMED",
      claimed_by: current.claimed_by,
      refusal_reason: `already_claimed_by:${current.claimed_by}`,
      evidence_signals: signals,
    };
  }

  // Rule 3: same agent re-claiming is idempotent
  if (current?.state === "CLAIMED" && current.claimed_by === agent) {
    signals.push("re_claim_by_same_agent");
    return {
      ok: true,
      state: "CLAIMED",
      claimed_by: agent,
      refusal_reason: null,
      evidence_signals: signals,
    };
  }

  // Grant the claim
  const now = new Date().toISOString();
  const rec: FileLock = {
    file_path: norm,
    state: "CLAIMED",
    claimed_by: agent,
    claimed_at_iso: now,
    claimed_session_id: session_id,
    claim_purpose: purpose,
    completed_by: null,
    completed_at_iso: null,
    last_transition_iso: now,
  };
  writeRecord(opts, rec);
  signals.push("claim_granted");
  return { ok: true, state: "CLAIMED", claimed_by: agent, refusal_reason: null, evidence_signals: signals };
}

// ── Release (return to UNCLAIMED) ────────────────────────────────────────

export function releaseFile(
  file_path: string,
  agent: Agent,
  opts: FileLockOptions,
): ClaimResult {
  const norm = normalizePath(file_path);
  const state = loadFileLocks(opts);
  const current = state[norm];
  if (!current) {
    return { ok: false, state: "UNCLAIMED", claimed_by: null, refusal_reason: "not_claimed", evidence_signals: [] };
  }
  if (current.state === "COMPLETED") {
    return { ok: false, state: "COMPLETED", claimed_by: current.completed_by, refusal_reason: "already_completed", evidence_signals: [] };
  }
  if (current.claimed_by !== agent) {
    return { ok: false, state: current.state, claimed_by: current.claimed_by, refusal_reason: `not_the_claimant · claimed_by:${current.claimed_by}`, evidence_signals: [] };
  }
  const now = new Date().toISOString();
  writeRecord(opts, {
    file_path: norm,
    state: "UNCLAIMED",
    claimed_by: null,
    claimed_at_iso: null,
    claimed_session_id: null,
    claim_purpose: null,
    completed_by: null,
    completed_at_iso: null,
    last_transition_iso: now,
  });
  return { ok: true, state: "UNCLAIMED", claimed_by: null, refusal_reason: null, evidence_signals: ["released"] };
}

// ── Mark complete (Twin should not re-code) ──────────────────────────────

export function markComplete(
  file_path: string,
  agent: Agent,
  opts: FileLockOptions,
): ClaimResult {
  const norm = normalizePath(file_path);
  const state = loadFileLocks(opts);
  const current = state[norm];
  if (current?.state === "CLAIMED" && current.claimed_by !== agent) {
    return { ok: false, state: "CLAIMED", claimed_by: current.claimed_by, refusal_reason: `only_claimant_can_mark_complete · claimed_by:${current.claimed_by}`, evidence_signals: [] };
  }
  const now = new Date().toISOString();
  writeRecord(opts, {
    file_path: norm,
    state: "COMPLETED",
    claimed_by: null,
    claimed_at_iso: null,
    claimed_session_id: null,
    claim_purpose: null,
    completed_by: agent,
    completed_at_iso: now,
    last_transition_iso: now,
  });
  return { ok: true, state: "COMPLETED", claimed_by: agent, refusal_reason: null, evidence_signals: [`completed_by:${agent}`] };
}

/** Reopen a completed file · returns to UNCLAIMED. Requires explicit reason. */
export function reopen(
  file_path: string,
  agent: Agent,
  reason: string,
  opts: FileLockOptions,
): ClaimResult {
  const norm = normalizePath(file_path);
  const state = loadFileLocks(opts);
  const current = state[norm];
  if (current?.state !== "COMPLETED") {
    return { ok: false, state: current?.state ?? "UNCLAIMED", claimed_by: null, refusal_reason: "not_completed · cannot_reopen", evidence_signals: [] };
  }
  const now = new Date().toISOString();
  writeRecord(opts, {
    file_path: norm,
    state: "UNCLAIMED",
    claimed_by: null,
    claimed_at_iso: null,
    claimed_session_id: null,
    claim_purpose: `reopened_by:${agent}·reason:${reason}`,
    completed_by: null,
    completed_at_iso: null,
    last_transition_iso: now,
  });
  return { ok: true, state: "UNCLAIMED", claimed_by: null, refusal_reason: null, evidence_signals: [`reopened_by:${agent}`] };
}

// ── Twin decision helper ─────────────────────────────────────────────────
//
// "Should Twin process this file?"
// Answers false if:
//   · file is COMPLETED_BY_NEX1
//   · file is CLAIMED_BY_NEX1 (avoid simultaneous edits)
//   · file is COMPLETED_BY_TwinNEX (twin already did it)
//
// Answers true if:
//   · file is UNCLAIMED
//   · file is CLAIMED_BY_TwinNEX (twin already has the claim · continue)

export interface ShouldProcessResult {
  readonly should_process: boolean;
  readonly current_state: FileState;
  readonly current_owner: Agent | null;
  readonly reason: string;
  readonly caller_must_decide: true;
}

export function shouldTwinProcess(file_path: string, opts: FileLockOptions): ShouldProcessResult {
  const norm = normalizePath(file_path);
  const state = loadFileLocks(opts);
  const current = state[norm];
  if (!current) {
    return { should_process: true, current_state: "UNCLAIMED", current_owner: null, reason: "unclaimed · Twin may claim and process", caller_must_decide: true };
  }
  if (current.state === "COMPLETED") {
    return {
      should_process: false,
      current_state: "COMPLETED",
      current_owner: current.completed_by,
      reason: `already_completed_by:${current.completed_by} · Twin must not re-code`,
      caller_must_decide: true,
    };
  }
  if (current.state === "CLAIMED") {
    if (current.claimed_by === "TwinNEX") {
      return { should_process: true, current_state: "CLAIMED", current_owner: "TwinNEX", reason: "already claimed by Twin · continue", caller_must_decide: true };
    }
    return {
      should_process: false,
      current_state: "CLAIMED",
      current_owner: current.claimed_by,
      reason: `currently_claimed_by:${current.claimed_by} · Twin must not edit simultaneously`,
      caller_must_decide: true,
    };
  }
  return { should_process: true, current_state: "UNCLAIMED", current_owner: null, reason: "unclaimed", caller_must_decide: true };
}

// ── Batch: what should Twin work on? ─────────────────────────────────────

export function twinCandidateFiles(
  candidate_paths: readonly string[],
  opts: FileLockOptions,
): {
  readonly available: readonly string[];
  readonly skipped_completed_by_nex1: readonly string[];
  readonly skipped_completed_by_twin: readonly string[];
  readonly skipped_claimed_by_nex1: readonly string[];
} {
  const state = loadFileLocks(opts);
  const available: string[] = [];
  const skipped_completed_by_nex1: string[] = [];
  const skipped_completed_by_twin: string[] = [];
  const skipped_claimed_by_nex1: string[] = [];
  for (const raw of candidate_paths) {
    const norm = normalizePath(raw);
    const cur = state[norm];
    if (!cur) { available.push(norm); continue; }
    if (cur.state === "COMPLETED" && cur.completed_by === "NEX1") {
      skipped_completed_by_nex1.push(norm);
    } else if (cur.state === "COMPLETED" && cur.completed_by === "TwinNEX") {
      skipped_completed_by_twin.push(norm);
    } else if (cur.state === "CLAIMED" && cur.claimed_by === "NEX1") {
      skipped_claimed_by_nex1.push(norm);
    } else {
      available.push(norm);
    }
  }
  return { available, skipped_completed_by_nex1, skipped_completed_by_twin, skipped_claimed_by_nex1 };
}

// ── Integrity ────────────────────────────────────────────────────────────

export function projectLockHash(opts: FileLockOptions): { readonly hash: string; readonly file_count: number } {
  const state = loadFileLocks(opts);
  const files = Object.keys(state).sort();
  return {
    hash: createHash("sha256").update(JSON.stringify(files.map((f) => ({ f, s: state[f].state, o: state[f].claimed_by ?? state[f].completed_by })))).digest("hex").slice(0, 32),
    file_count: files.length,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function writeRecord(opts: FileLockOptions, rec: FileLock): void {
  const p = locksPath(opts);
  ensureDir(path.dirname(p));
  appendFileSync(p, JSON.stringify(rec) + "\n");
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
