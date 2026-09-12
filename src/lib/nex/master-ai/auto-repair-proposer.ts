// src/lib/nex/master-ai/auto-repair-proposer.ts
//
// NEX Master AI · Auto-Repair Proposer (World-First §3)
// Philip 2026-09-07 · AUTHORIZE
//
// When error-detection-engine surfaces a NEW error, generate a bounded
// Programmer delegation via existing delegation.ts machinery. The
// delegation flows through Y-W4-3's safe consumer path (validation +
// Phase G bounds + observation-only execution).
//
// HONESTY:
//   · This module does NOT mutate code.
//   · It creates a PROPOSAL for what a real repair would attempt.
//   · Actual code mutation requires the separately-authorized
//     programmer-improvement candidate loop.
//   · Every proposal is dedup'd against error_id · never spams.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { autoRepairProposalsPath } from "./paths";
import { unresolvedBySeverity, type EcosystemErrorRecord, type EcosystemErrorKind } from "./error-detection-engine";
import { delegateTask, type DelegationRecord } from "./delegation";
import { classifyTask, withEvidence, unknownDim, type TaskComplexityClassification } from "./task-complexity-classification";

export type RepairStrategy =
  | "ADD_TYPE_ANNOTATION"
  | "ADD_NULL_CHECK"
  | "ADD_TIMEOUT_HANDLING"
  | "ADD_RETRY_WITH_BACKOFF"
  | "ADD_CIRCUIT_BREAKER"
  | "ADD_INPUT_VALIDATION"
  | "FIX_TEST_ASSERTION"
  | "INVESTIGATE_MANUALLY"     // when no clear strategy · escalate to human
  | "UNKNOWN";

export type AutoRepairProposal = {
  proposal_id: string;
  recorded_at_iso: string;
  error_id: string;
  error_kind: EcosystemErrorKind;
  error_severity: EcosystemErrorRecord["severity_hint"];
  error_signature_hash: string;
  strategy: RepairStrategy;
  strategy_reasoning: string;
  delegation_id: string | null;                      // populated after delegation created
  complexity_classification_id: string | null;
  status: "PROPOSED" | "DELEGATED" | "SKIPPED" | "SUPERSEDED";
  skip_reason: string | null;
};

const STRATEGY_BY_KIND: Record<EcosystemErrorKind, RepairStrategy> = {
  TYPE_ERROR: "ADD_TYPE_ANNOTATION",
  TEST_FAILURE: "FIX_TEST_ASSERTION",
  RUNTIME_ERROR: "ADD_NULL_CHECK",
  BUILD_ERROR: "INVESTIGATE_MANUALLY",
  REGRESSION: "INVESTIGATE_MANUALLY",
  LEDGER_CORRUPTION: "INVESTIGATE_MANUALLY",
  UNKNOWN: "INVESTIGATE_MANUALLY",
};

/** Refine strategy based on message content · deterministic keyword match. */
function refineStrategy(kind: EcosystemErrorKind, message: string): RepairStrategy {
  const m = message.toLowerCase();
  if (kind === "RUNTIME_ERROR") {
    if (/timeout|deadline/i.test(m)) return "ADD_TIMEOUT_HANDLING";
    if (/circuit|breaker|too many failures/i.test(m)) return "ADD_CIRCUIT_BREAKER";
    if (/retry|rate limit|429/i.test(m)) return "ADD_RETRY_WITH_BACKOFF";
    if (/undefined|null|cannot read/i.test(m)) return "ADD_NULL_CHECK";
    if (/invalid input|validation/i.test(m)) return "ADD_INPUT_VALIDATION";
  }
  return STRATEGY_BY_KIND[kind];
}

/** Consider ONE error record · propose a repair strategy · create a
 *  bounded delegation. Deduplicated against prior proposals for the same
 *  error signature (prevents spam). */
export function proposeRepairFor(input: {
  error: EcosystemErrorRecord;
  invoker: string;
}): AutoRepairProposal {
  // Dedup · has this error already been proposed for repair?
  const existing = readAllProposals().find((p) =>
    p.error_signature_hash === input.error.signature_hash &&
    p.status !== "SKIPPED" && p.status !== "SUPERSEDED"
  );
  if (existing) {
    return { ...existing, status: "SKIPPED", skip_reason: "already_proposed" };
  }

  const strategy = refineStrategy(input.error.kind, input.error.representative_message);

  // Classify the repair task complexity
  const classification: TaskComplexityClassification = classifyTask({
    task_slug: `auto_repair_${input.error.signature_hash.slice(0, 8)}`,
    task_description: `Auto-repair proposal for ${input.error.kind} · signature ${input.error.signature_hash.slice(0, 8)} · strategy ${strategy} · error: ${input.error.representative_message.slice(0, 200)}`,
    dimensions: {
      novelty: input.error.occurrences === 1 ? withEvidence(7, "single-occurrence · previously unseen") : withEvidence(3, `recurring ${input.error.occurrences}× · known pattern`),
      dependencies: withEvidence(4, "typical bounded repair · minor file touch"),
      risk: input.error.severity_hint === "CRITICAL" ? withEvidence(8, "critical severity") : input.error.severity_hint === "HIGH" ? withEvidence(6, "high severity") : withEvidence(3, "medium/low severity"),
      required_knowledge: strategy === "INVESTIGATE_MANUALLY" ? withEvidence(7, "requires human investigation") : withEvidence(4, `strategy ${strategy} is well-known`),
      time_estimate: withEvidence(4, "bounded repair · < 1 hour typical"),
      scale: withEvidence(2, "single-file typical scope"),
      reversibility: withEvidence(2, "small change · easily reverted"),
      verification_difficulty: input.error.kind === "TEST_FAILURE" ? withEvidence(2, "existing test would verify") : withEvidence(5, "may require new test"),
    },
  });

  // Create bounded Programmer delegation (does NOT auto-execute · Y-W4-3 executor
  // will validate + run observation-only)
  let delegationId: string | null = null;
  let status: AutoRepairProposal["status"] = "PROPOSED";
  if (strategy !== "INVESTIGATE_MANUALLY" && !classification.requires_founder_approval) {
    try {
      const delegation: DelegationRecord = delegateTask({
        source_agent_id: "master_ai",
        target_agent_id: "programmer",
        task_slug: classification.task_slug,
        task_description: `Auto-repair: apply ${strategy} to resolve ${input.error.kind} · signature ${input.error.signature_hash.slice(0, 8)} · Master AI observation-only proposal · full code mutation requires programmer-improvement authorization`,
        bounds: {
          max_iterations: classification.recommended_max_iterations,
          max_runtime_ms: classification.recommended_max_runtime_ms,
          max_files_changed: classification.recommended_max_files_changed,
        },
        reason: `auto_repair_for_${input.error.error_id.slice(0, 8)}`,
      });
      delegationId = delegation.delegation_id;
      status = "DELEGATED";
    } catch (err) {
      status = "SKIPPED";
    }
  } else {
    status = "SKIPPED";   // requires human investigation OR founder approval
  }

  const rec: AutoRepairProposal = {
    proposal_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
    error_id: input.error.error_id,
    error_kind: input.error.kind,
    error_severity: input.error.severity_hint,
    error_signature_hash: input.error.signature_hash,
    strategy,
    strategy_reasoning: `strategy ${strategy} derived from error kind ${input.error.kind} + message keywords`,
    delegation_id: delegationId,
    complexity_classification_id: classification.classification_id,
    status,
    skip_reason: status === "SKIPPED"
      ? (strategy === "INVESTIGATE_MANUALLY" ? "requires_human_investigation" : classification.requires_founder_approval ? "requires_founder_approval" : "delegation_creation_failed")
      : null,
  };
  appendJsonLine(autoRepairProposalsPath(), rec);
  return rec;
}

/** Bounded batch · propose repairs for up to N unresolved errors of
 *  CRITICAL/HIGH severity. Returns all proposals (including SKIPPED). */
export function proposeRepairsForTopErrors(input: { max_proposals?: number; invoker: string }): AutoRepairProposal[] {
  const maxProposals = input.max_proposals ?? 3;
  const bySev = unresolvedBySeverity();
  const priority: EcosystemErrorRecord[] = [...bySev.CRITICAL, ...bySev.HIGH, ...bySev.MEDIUM].slice(0, maxProposals);
  const out: AutoRepairProposal[] = [];
  for (const err of priority) {
    out.push(proposeRepairFor({ error: err, invoker: input.invoker }));
  }
  return out;
}

export function readAllProposals(): AutoRepairProposal[] {
  return readJsonlAll<AutoRepairProposal>(autoRepairProposalsPath());
}

export function _resetAutoRepairForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(autoRepairProposalsPath())) fs.unlinkSync(autoRepairProposalsPath()); } catch { /* ignore */ }
}
