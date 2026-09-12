// src/lib/nex/master-ai/self-improvement-scheduler.ts
//
// NEX Master AI · Self-Improvement Scheduler (World-First §4)
// Philip 2026-09-07 · AUTHORIZE
//
// Continuously scans Master AI's own subsystems for improvement
// opportunities. Generates candidate proposals that flow through the
// existing teaching.ts + capability_proposals AWAITING_APPROVAL gate.
//
// PRESERVATION:
//   · Never auto-promotes · always AWAITING_APPROVAL
//   · Read-only observation of own subsystems
//   · Deterministic candidate generation from evidence
//   · Deduplicated by candidate slug · never spams

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { selfImprovementCandidatesPath } from "./paths";

// ═════════════════════════════════════════════════════════════════════
// Candidate kinds
// ═════════════════════════════════════════════════════════════════════

export type ImprovementCandidateKind =
  | "MISSING_ADAPTER"          // subsystem could benefit from adding an adapter
  | "STALE_KNOWLEDGE"          // knowledge_ledger entries past freshness
  | "MISSING_TEST"             // subsystem has no contract test coverage
  | "MISSING_METRIC"           // subsystem lacks a measurable signal
  | "MISSING_DOCUMENTATION"    // subsystem behavior not documented
  | "REDUNDANT_LEDGER"         // two ledgers cover overlapping concerns
  | "SLOW_CADENCE"             // Master AI cadence too slow for observed rate
  | "MISSING_ROTATION"         // ledger exceeds soft cap and rotation not applied
  | "WEAK_CONFIDENCE"          // subsystem outputs consistently LOW confidence
  | "UNKNOWN";

export type SelfImprovementCandidate = {
  candidate_id: string;
  recorded_at_iso: string;
  kind: ImprovementCandidateKind;
  target_module: string;                            // e.g. "connectivity-provider-comparison"
  candidate_slug: string;                           // deterministic dedup key
  detection_reasoning: string;                      // required ≥ 15 chars
  evidence_refs: readonly string[];
  proposed_change: string;                          // brief description of the improvement
  expected_benefit: string;
  estimated_effort: "TRIVIAL" | "MODERATE" | "COMPLEX" | "EXTREME" | "UNKNOWN";
  requires_founder_approval: boolean;
  authorization_state: "PROPOSED" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | "SUPERSEDED";
};

export class InvalidCandidateError extends Error {
  constructor(reason: string) { super(`invalid_candidate:${reason}`); }
}

export function recordCandidate(input: Omit<SelfImprovementCandidate, "candidate_id" | "recorded_at_iso" | "authorization_state">): SelfImprovementCandidate {
  if (!input.candidate_slug || input.candidate_slug.length < 3) throw new InvalidCandidateError("candidate_slug_too_short");
  if (!input.detection_reasoning || input.detection_reasoning.length < 15) throw new InvalidCandidateError("detection_reasoning_too_short");
  // Dedup by candidate_slug
  const existing = readAllCandidates().find((c) => c.candidate_slug === input.candidate_slug && c.authorization_state !== "SUPERSEDED" && c.authorization_state !== "REJECTED");
  if (existing) {
    return { ...existing, authorization_state: "SUPERSEDED" };   // return existing without appending
  }
  const rec: SelfImprovementCandidate = {
    ...input,
    candidate_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
    authorization_state: "AWAITING_APPROVAL",       // ALWAYS awaiting approval · never auto-promoted
  };
  appendJsonLine(selfImprovementCandidatesPath(), rec);
  return rec;
}

export function readAllCandidates(): SelfImprovementCandidate[] {
  return readJsonlAll<SelfImprovementCandidate>(selfImprovementCandidatesPath());
}

/** Latest per candidate_slug (dedup). */
export function currentCandidates(): SelfImprovementCandidate[] {
  const latest = new Map<string, SelfImprovementCandidate>();
  for (const c of readAllCandidates()) latest.set(c.candidate_slug, c);
  return Array.from(latest.values());
}

export function summariseByAuthorization(): Record<SelfImprovementCandidate["authorization_state"], number> {
  const out: Record<SelfImprovementCandidate["authorization_state"], number> = { PROPOSED: 0, AWAITING_APPROVAL: 0, APPROVED: 0, REJECTED: 0, SUPERSEDED: 0 };
  for (const c of currentCandidates()) out[c.authorization_state]++;
  return out;
}

// ═════════════════════════════════════════════════════════════════════
// Deterministic self-scan · generates candidates from observed state
// ═════════════════════════════════════════════════════════════════════

export type ScanInputs = {
  module_name: string;                              // e.g. "master-ai"
  contract_test_files_count: number;                // observed
  ledger_row_counts: Record<string, number>;        // per-ledger sizes
  ledger_soft_cap: number;                          // e.g. 20_000
  stale_knowledge_count: number;
  low_confidence_output_ratio: number;              // 0..1
  cadence_ms_observed: number;
  cadence_ms_target: number;
  invoker: string;
};

export function scanForSelfImprovements(input: ScanInputs): SelfImprovementCandidate[] {
  const out: SelfImprovementCandidate[] = [];

  // MISSING_TEST: if contract test files is 0 while ledgers exist
  const ledgerCount = Object.keys(input.ledger_row_counts).length;
  if (input.contract_test_files_count === 0 && ledgerCount > 0) {
    out.push(recordCandidate({
      kind: "MISSING_TEST", target_module: input.module_name,
      candidate_slug: `missing_test_${input.module_name}`,
      detection_reasoning: `Module has ${ledgerCount} ledger(s) but zero contract test files · high risk of undetected regression`,
      evidence_refs: [`self_improvement_scan:${input.module_name}`],
      proposed_change: "Add contract tests covering ledger append/read + validation logic",
      expected_benefit: "Reduces regression risk · surfaces bugs during CI",
      estimated_effort: "MODERATE",
      requires_founder_approval: false,
    }));
  }

  // MISSING_ROTATION: any ledger exceeding soft cap
  for (const [ledger, count] of Object.entries(input.ledger_row_counts)) {
    if (count > input.ledger_soft_cap) {
      out.push(recordCandidate({
        kind: "MISSING_ROTATION", target_module: input.module_name,
        candidate_slug: `rotation_needed_${ledger}`,
        detection_reasoning: `Ledger ${ledger} has ${count} rows exceeding soft cap ${input.ledger_soft_cap} · storage-rotation should run`,
        evidence_refs: [`ledger_row_count:${ledger}`],
        proposed_change: `Trigger rotation for ${ledger} · archive old rows · keep recent 5k rows live`,
        expected_benefit: "Bounded storage growth · improved read performance",
        estimated_effort: "TRIVIAL",
        requires_founder_approval: false,
      }));
    }
  }

  // STALE_KNOWLEDGE: knowledge entries past freshness
  if (input.stale_knowledge_count >= 5) {
    out.push(recordCandidate({
      kind: "STALE_KNOWLEDGE", target_module: input.module_name,
      candidate_slug: `stale_knowledge_${input.module_name}`,
      detection_reasoning: `${input.stale_knowledge_count} knowledge entries past freshness TTL · re-verification queue building`,
      evidence_refs: [`stale_knowledge_count:${input.stale_knowledge_count}`],
      proposed_change: "Prioritise research re-verification for stale entries",
      expected_benefit: "Higher confidence per-record · reduced UNKNOWN in Philip briefings",
      estimated_effort: "MODERATE",
      requires_founder_approval: false,
    }));
  }

  // WEAK_CONFIDENCE: if >50% of outputs are LOW confidence
  if (input.low_confidence_output_ratio > 0.5) {
    out.push(recordCandidate({
      kind: "WEAK_CONFIDENCE", target_module: input.module_name,
      candidate_slug: `weak_confidence_${input.module_name}`,
      detection_reasoning: `${Math.round(input.low_confidence_output_ratio * 100)}% of module outputs are LOW confidence · evidence base needs strengthening`,
      evidence_refs: [`low_confidence_ratio:${input.low_confidence_output_ratio}`],
      proposed_change: "Register additional authoritative sources OR run additional cross-source reconciliation",
      expected_benefit: "Higher-tier evidence yields MEDIUM/HIGH confidence outputs",
      estimated_effort: "MODERATE",
      requires_founder_approval: false,
    }));
  }

  // SLOW_CADENCE: if observed cadence is significantly slower than target
  if (input.cadence_ms_observed > input.cadence_ms_target * 1.5 && input.cadence_ms_target > 0) {
    out.push(recordCandidate({
      kind: "SLOW_CADENCE", target_module: input.module_name,
      candidate_slug: `slow_cadence_${input.module_name}`,
      detection_reasoning: `Observed cadence ${input.cadence_ms_observed}ms exceeds target ${input.cadence_ms_target}ms by >50% · subsystem lagging`,
      evidence_refs: [`cadence_observed:${input.cadence_ms_observed}`],
      proposed_change: "Investigate cadence bottleneck · reduce per-tick work OR increase tick frequency",
      expected_benefit: "Timelier detection + response · closer to real-time intelligence",
      estimated_effort: "MODERATE",
      requires_founder_approval: false,
    }));
  }

  return out;
}

export function _resetSelfImprovementForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(selfImprovementCandidatesPath())) fs.unlinkSync(selfImprovementCandidatesPath()); } catch { /* ignore */ }
}
