// WO-CAP-EXECUTION-01 · governed execution pipeline.
//
// Founder-locked 2026-09-13 · connects Broker-approved proposal to the
// existing workstation machinery (WO-01…WO-09) and enforces the 10-point
// verification standard before allowing CAP resolution.
//
//   REAL WORLD → EVIDENCE → GAP → DIAGNOSIS → PROPOSAL → FOUNDER SIG
//     → AUTHORITY BROKER → ENGINEERING EXECUTION → 10-POINT VERIFICATION
//     → CAP RESOLVED (only if all 10 pass)
//
// AUTO_FIX_KINDS remains empty · this pipeline runs only when the founder
// has signed the proposal AND the Authority Broker approved it.

import { randomUUID } from "node:crypto";
import { provenanceChainHash, sha256Hex, canonicalJson } from "@/lib/nex-intelligence/provenance";
import { getStorage } from "@/lib/nex/storage/registry";
import { loadCap, updateCapStatus } from "./registry";
import { authorityBrokerGate, type CapEngineeringProposal } from "./nex1-engineer";
import type { CapabilityGap } from "./types";

export const CAP_EXECUTION_ATTEMPTS_COLLECTION = "nex_cap_execution_attempts";
export const CAP_RESOLUTION_EVIDENCE_COLLECTION = "nex_cap_resolution_evidence";

// ── The 10 verification points (founder-locked) ────────────────────────

export type VerificationCheckKind =
  | "intended_change_happened"
  | "build_passed"
  | "tests_passed"
  | "security_checks_passed"
  | "runtime_passed"
  | "original_cap_trigger_gone"
  | "no_regression_introduced"
  | "evidence_persisted"
  | "evidence_in_production_workforce"
  | "causal_chain_preserved";

export interface VerificationCheckResult {
  readonly kind: VerificationCheckKind;
  readonly passed: boolean;
  readonly evidence_refs: readonly string[];
  readonly reason: string;
}

// ── Execution attempt record ───────────────────────────────────────────

export interface CapExecutionAttempt {
  readonly record_type: "NEX_CAP_EXECUTION_ATTEMPT";
  readonly attempt_id: string;
  readonly cap_id: string;
  readonly proposal_id: string;
  readonly broker_approval_reason: string;
  readonly workstation_trace_id: string;
  readonly pre_state_hash: string;
  readonly post_state_hash: string | null;
  readonly stages_executed: readonly {
    readonly stage: "WO-01" | "WO-04" | "WO-05" | "WO-06" | "WO-07" | "WO-08" | "WO-09";
    readonly ok: boolean;
    readonly evidence_ref: string;
    readonly reason: string;
  }[];
  readonly verification: readonly VerificationCheckResult[];
  readonly all_10_passed: boolean;
  readonly cap_resolution: "RESOLVED" | "REFUSED" | "FAILED_EXECUTION";
  readonly started_at: string;
  readonly finished_at: string;
  readonly environment: "PRODUCTION_WORKFORCE" | "TEST" | "SIMULATION" | "FIXTURE" | "DEVELOPMENT";
  readonly provenance_chain_hash: string;
}

// ── Stage adapter contracts (test-injectable) ──────────────────────────

/**
 * Stage adapters wrap the existing WO-01…WO-09 workstation code paths so
 * this module doesn't hard-import them (which would create cycles). Each
 * adapter runs one stage and returns a real outcome.
 *
 * In production, `defaultWorkstationAdapter` should be replaced by an
 * adapter that invokes the actual workstation trace machinery. This
 * module treats stage failures identically to any other verification
 * point: the CAP stays OPEN with failure evidence.
 */
export interface StageOutcome {
  readonly ok: boolean;
  readonly evidence_ref: string;
  readonly reason: string;
}

export interface WorkstationAdapter {
  readonly run_wo_01_state_setup: (trace_id: string, cap: CapabilityGap) => Promise<StageOutcome>;
  readonly run_wo_04_broker_write: (trace_id: string, proposal: CapEngineeringProposal) => Promise<StageOutcome>;
  readonly run_wo_05_build: (trace_id: string) => Promise<StageOutcome>;
  readonly run_wo_06_runtime: (trace_id: string) => Promise<StageOutcome>;
  readonly run_wo_07_specialist_validation: (trace_id: string) => Promise<StageOutcome>;
  readonly run_wo_08_evidence_persist: (trace_id: string) => Promise<StageOutcome>;
  readonly run_wo_09_corrector_check: (trace_id: string) => Promise<StageOutcome>;
}

/**
 * Default adapter is intentionally NON-EXECUTING. Founder doctrine: the
 * production adapter is wired in a separate WO once the real workstation
 * is proven end-to-end. Until then, every stage returns ok:false so a
 * missed injection cannot silently mark a CAP RESOLVED.
 */
export const defaultWorkstationAdapter: WorkstationAdapter = {
  run_wo_01_state_setup: async () => ({ ok: false, evidence_ref: "no-adapter-wired", reason: "no production workstation adapter registered · WO-CAP-EXECUTION-02 pending" }),
  run_wo_04_broker_write: async () => ({ ok: false, evidence_ref: "no-adapter-wired", reason: "no production workstation adapter registered" }),
  run_wo_05_build:        async () => ({ ok: false, evidence_ref: "no-adapter-wired", reason: "no production workstation adapter registered" }),
  run_wo_06_runtime:      async () => ({ ok: false, evidence_ref: "no-adapter-wired", reason: "no production workstation adapter registered" }),
  run_wo_07_specialist_validation: async () => ({ ok: false, evidence_ref: "no-adapter-wired", reason: "no production workstation adapter registered" }),
  run_wo_08_evidence_persist: async () => ({ ok: false, evidence_ref: "no-adapter-wired", reason: "no production workstation adapter registered" }),
  run_wo_09_corrector_check: async () => ({ ok: false, evidence_ref: "no-adapter-wired", reason: "no production workstation adapter registered" }),
};

// ── Verifier contracts (test-injectable) ───────────────────────────────

/**
 * The verifiers are the founder-locked 10 checks. Each is a separate
 * pluggable function so a specific CAP kind can override behaviour if
 * necessary (e.g. `original_cap_trigger_gone` for a rate-limiter CAP
 * re-checks the host's consecutive_failures).
 */
export interface Verifier {
  readonly kind: VerificationCheckKind;
  readonly check: (input: {
    cap: CapabilityGap;
    proposal: CapEngineeringProposal;
    workstation_trace_id: string;
    stages: readonly CapExecutionAttempt["stages_executed"][number][];
  }) => Promise<VerificationCheckResult>;
}

/** Default set — deterministic, non-optimistic verifiers. */
export const defaultVerifiers: readonly Verifier[] = Object.freeze([
  {
    kind: "intended_change_happened",
    check: async ({ stages }) => {
      const wo04 = stages.find((s) => s.stage === "WO-04");
      const ok = !!wo04?.ok;
      return { kind: "intended_change_happened", passed: ok, evidence_refs: wo04 ? [wo04.evidence_ref] : [], reason: ok ? "WO-04 broker write succeeded" : "WO-04 broker write did NOT succeed" };
    },
  },
  {
    kind: "build_passed",
    check: async ({ stages }) => {
      const s = stages.find((x) => x.stage === "WO-05");
      const ok = !!s?.ok;
      return { kind: "build_passed", passed: ok, evidence_refs: s ? [s.evidence_ref] : [], reason: ok ? "WO-05 build succeeded" : "WO-05 build did NOT succeed" };
    },
  },
  {
    kind: "tests_passed",
    check: async ({ stages }) => {
      // Tests are part of WO-07 specialist validation in our workstation model.
      const s = stages.find((x) => x.stage === "WO-07");
      const ok = !!s?.ok;
      return { kind: "tests_passed", passed: ok, evidence_refs: s ? [s.evidence_ref] : [], reason: ok ? "WO-07 specialist tests passed" : "WO-07 specialist tests did NOT pass" };
    },
  },
  {
    kind: "security_checks_passed",
    check: async () => ({ kind: "security_checks_passed", passed: false, evidence_refs: [], reason: "no security-checks adapter wired · founder-locked to fail-closed" }),
  },
  {
    kind: "runtime_passed",
    check: async ({ stages }) => {
      const s = stages.find((x) => x.stage === "WO-06");
      const ok = !!s?.ok;
      return { kind: "runtime_passed", passed: ok, evidence_refs: s ? [s.evidence_ref] : [], reason: ok ? "WO-06 runtime succeeded" : "WO-06 runtime did NOT succeed" };
    },
  },
  {
    kind: "original_cap_trigger_gone",
    check: async ({ cap }) => {
      // Founder-locked: re-run the CAP's ORIGINAL detection trigger. Fail-closed until wired.
      return { kind: "original_cap_trigger_gone", passed: false, evidence_refs: [], reason: `original detection re-check not wired for cap kind "${cap.kind}" · fail-closed per doctrine` };
    },
  },
  {
    kind: "no_regression_introduced",
    check: async () => ({ kind: "no_regression_introduced", passed: false, evidence_refs: [], reason: "no regression-check adapter wired · founder-locked to fail-closed" }),
  },
  {
    kind: "evidence_persisted",
    check: async ({ stages }) => {
      const s = stages.find((x) => x.stage === "WO-08");
      const ok = !!s?.ok;
      return { kind: "evidence_persisted", passed: ok, evidence_refs: s ? [s.evidence_ref] : [], reason: ok ? "WO-08 evidence persist succeeded" : "WO-08 evidence persist did NOT succeed" };
    },
  },
  {
    kind: "evidence_in_production_workforce",
    check: async () => ({ kind: "evidence_in_production_workforce", passed: false, evidence_refs: [], reason: "production-environment check not wired · fail-closed" }),
  },
  {
    kind: "causal_chain_preserved",
    check: async ({ cap, proposal, workstation_trace_id, stages }) => {
      // Chain: CAP evidence → proposal.evidence_chain → workstation trace → stage evidence.
      const chainOk =
        cap.evidence.length > 0 &&
        proposal.evidence_chain.length > 0 &&
        workstation_trace_id.length > 0 &&
        stages.every((s) => s.evidence_ref.length > 0);
      return {
        kind: "causal_chain_preserved",
        passed: chainOk,
        evidence_refs: [cap.cap_id, proposal.proposal_id, workstation_trace_id, ...stages.map((s) => s.evidence_ref)],
        reason: chainOk ? "complete causal chain: CAP → proposal → workstation trace → stage evidence" : "one or more chain links missing",
      };
    },
  },
]);

// ── Pre-state / post-state hash helpers ───────────────────────────────

function hashSnapshot(snapshot: Record<string, unknown>): string {
  return sha256Hex(canonicalJson(snapshot));
}

// ── Public API · execute a Broker-approved proposal ────────────────────

export interface ExecuteCapProposalInput {
  readonly cap_id: string;
  readonly proposal_id: string;
  readonly founder_signature_hex: string;
  readonly trusted_founder_public_keys_hex: readonly string[];
  readonly environment: "PRODUCTION_WORKFORCE" | "TEST" | "SIMULATION" | "FIXTURE" | "DEVELOPMENT";
  readonly workstation?: WorkstationAdapter;
  readonly verifiers?: readonly Verifier[];
  /** RUNTIME-10 · caller has already independently verified authorization
   *  via the founder-delegation + delegated-authorization + Orchestrator
   *  gate-receipt chain. When supplied, executeCapProposal skips its
   *  internal legacy Broker signature gate and uses this pre-verified
   *  proposal + reason. WO-04 remains the final deterministic file-
   *  mutation gate downstream. This is NOT a bypass of authority · it
   *  is a different, stronger authority path (delegation model). */
  readonly pre_verified_authorization?: {
    readonly proposal: CapEngineeringProposal;
    readonly approval_reason: string;
  } | null;
}

export interface ExecuteCapProposalResult {
  readonly attempt: CapExecutionAttempt;
  readonly outcome: "RESOLVED" | "REFUSED" | "FAILED_EXECUTION";
  readonly reason: string;
}

/**
 * Founder-locked pipeline. Every step is fail-closed:
 *  1. Load CAP + Broker approval (signature must verify)
 *  2. Capture pre-state hash
 *  3. Run WO-01…WO-09 stages; any stage failure aborts
 *  4. Run the 10 verifiers; any failure aborts
 *  5. CAP → RESOLVED only when EVERY step passes
 *  6. Persist execution attempt with full evidence chain
 */
export async function executeCapProposal(input: ExecuteCapProposalInput): Promise<ExecuteCapProposalResult> {
  const started_at = new Date().toISOString();
  const attempt_id = `CAP-EXEC-${input.cap_id}-${randomUUID().slice(0, 8)}`;
  const workstation_trace_id = `WS-TRACE-${randomUUID().slice(0, 16)}`;
  const adapter = input.workstation ?? defaultWorkstationAdapter;
  const verifiers = input.verifiers ?? defaultVerifiers;

  // (0) Load CAP
  const cap = await loadCap(input.cap_id);
  if (!cap) {
    return finalize({
      attempt_id, cap_id: input.cap_id, proposal_id: input.proposal_id,
      workstation_trace_id, started_at, environment: input.environment,
      broker_reason: "cap_not_found", pre_state_hash: hashSnapshot({ cap: null }),
      stages: [], verification: [], resolution: "REFUSED",
      reason: `cap ${input.cap_id} not found`,
    });
  }

  // (1) Authority gate · either legacy direct-signature Broker OR
  //     RUNTIME-10 pre-verified delegation authorization.
  const gate = input.pre_verified_authorization
    ? {
        allowed: true,
        reason: input.pre_verified_authorization.approval_reason,
        proposal: input.pre_verified_authorization.proposal,
      }
    : await authorityBrokerGate({
        proposal_id: input.proposal_id,
        founder_signature_hex: input.founder_signature_hex,
        trusted_founder_public_keys_hex: input.trusted_founder_public_keys_hex,
      });
  if (!gate.allowed || !gate.proposal) {
    return finalize({
      attempt_id, cap_id: cap.cap_id, proposal_id: input.proposal_id,
      workstation_trace_id, started_at, environment: input.environment,
      broker_reason: gate.reason, pre_state_hash: hashSnapshot({ cap }),
      stages: [], verification: [], resolution: "REFUSED",
      reason: `Broker refused: ${gate.reason}`,
    });
  }
  const proposal = gate.proposal;

  // (2) ESCALATE proposals cannot be executed by this pipeline
  if (proposal.resolver_outcome === "ESCALATE") {
    return finalize({
      attempt_id, cap_id: cap.cap_id, proposal_id: input.proposal_id,
      workstation_trace_id, started_at, environment: input.environment,
      broker_reason: gate.reason, pre_state_hash: hashSnapshot({ cap }),
      stages: [], verification: [], resolution: "REFUSED",
      reason: "ESCALATE proposals require founder manual resolution, not pipeline execution",
    });
  }

  // (3) Environment gate · production-only counts toward Capability Growth
  if (input.environment !== "PRODUCTION_WORKFORCE") {
    // Allow the mechanics to run in TEST/SIMULATION but never mark RESOLVED
    // — this is the founder-locked "evidence_in_production_workforce" invariant.
    // We continue through the stages so tests can exercise the pipeline, but
    // the verifier will fail-closed on the environment check.
  }

  const pre_state_hash = hashSnapshot({ cap, proposal, environment: input.environment });

  // (4) Update CAP status: IN_PROGRESS
  await updateCapStatus({ cap_id: cap.cap_id, status: "IN_PROGRESS", resolution_note: `execution attempt ${attempt_id} started` });

  // (5) Run workstation stages sequentially · any stage failure aborts
  const stages: CapExecutionAttempt["stages_executed"] = [];
  const stageRuns: Array<{ stage: "WO-01" | "WO-04" | "WO-05" | "WO-06" | "WO-07" | "WO-08" | "WO-09"; fn: () => Promise<StageOutcome> }> = [
    { stage: "WO-01", fn: () => adapter.run_wo_01_state_setup(workstation_trace_id, cap) },
    { stage: "WO-04", fn: () => adapter.run_wo_04_broker_write(workstation_trace_id, proposal) },
    { stage: "WO-05", fn: () => adapter.run_wo_05_build(workstation_trace_id) },
    { stage: "WO-06", fn: () => adapter.run_wo_06_runtime(workstation_trace_id) },
    { stage: "WO-07", fn: () => adapter.run_wo_07_specialist_validation(workstation_trace_id) },
    { stage: "WO-08", fn: () => adapter.run_wo_08_evidence_persist(workstation_trace_id) },
    { stage: "WO-09", fn: () => adapter.run_wo_09_corrector_check(workstation_trace_id) },
  ];
  let anyStageFailed = false;
  for (const s of stageRuns) {
    let outcome: StageOutcome;
    try {
      outcome = await s.fn();
    } catch (e) {
      outcome = { ok: false, evidence_ref: `stage-threw:${(e as Error).message.slice(0, 32)}`, reason: (e as Error).message };
    }
    stages.push({ stage: s.stage, ok: outcome.ok, evidence_ref: outcome.evidence_ref, reason: outcome.reason });
    if (!outcome.ok) { anyStageFailed = true; break; }
  }

  // (6) Run the 10 verifiers · every one must pass
  const verification: VerificationCheckResult[] = [];
  let allPassed = !anyStageFailed;
  for (const v of verifiers) {
    let result: VerificationCheckResult;
    try {
      result = await v.check({ cap, proposal, workstation_trace_id, stages });
    } catch (e) {
      result = { kind: v.kind, passed: false, evidence_refs: [], reason: `verifier threw: ${(e as Error).message}` };
    }
    verification.push(result);
    if (!result.passed) allPassed = false;
  }
  if (input.environment !== "PRODUCTION_WORKFORCE") {
    allPassed = false;   // founder-locked: only production evidence counts
  }

  const resolution: "RESOLVED" | "FAILED_EXECUTION" = allPassed ? "RESOLVED" : "FAILED_EXECUTION";
  const failureReasons = [...(anyStageFailed ? ["one or more workstation stages failed"] : []), ...verification.filter((v) => !v.passed).map((v) => `${v.kind}: ${v.reason}`)];

  return finalize({
    attempt_id, cap_id: cap.cap_id, proposal_id: proposal.proposal_id,
    workstation_trace_id, started_at, environment: input.environment,
    broker_reason: gate.reason, pre_state_hash,
    stages, verification, resolution,
    reason: allPassed ? "all 10 verifications passed · CAP RESOLVED" : failureReasons.join(" · "),
  });
}

// ── Finalize + persist ────────────────────────────────────────────────

async function finalize(input: {
  attempt_id: string;
  cap_id: string;
  proposal_id: string;
  workstation_trace_id: string;
  started_at: string;
  environment: CapExecutionAttempt["environment"];
  broker_reason: string;
  pre_state_hash: string;
  stages: CapExecutionAttempt["stages_executed"];
  verification: readonly VerificationCheckResult[];
  resolution: "RESOLVED" | "REFUSED" | "FAILED_EXECUTION";
  reason: string;
}): Promise<ExecuteCapProposalResult> {
  const finished_at = new Date().toISOString();
  const post_state = { cap_id: input.cap_id, resolution: input.resolution, stages: input.stages, verification: input.verification };
  const post_state_hash = hashSnapshot(post_state);
  const all_10_passed = input.resolution === "RESOLVED" && input.verification.length === defaultVerifiers.length && input.verification.every((v) => v.passed);

  const base = {
    record_type: "NEX_CAP_EXECUTION_ATTEMPT" as const,
    attempt_id: input.attempt_id,
    cap_id: input.cap_id,
    proposal_id: input.proposal_id,
    broker_approval_reason: input.broker_reason,
    workstation_trace_id: input.workstation_trace_id,
    pre_state_hash: input.pre_state_hash,
    post_state_hash,
    stages_executed: Object.freeze([...input.stages]) as CapExecutionAttempt["stages_executed"],
    verification: Object.freeze([...input.verification]) as readonly VerificationCheckResult[],
    all_10_passed,
    cap_resolution: input.resolution,
    started_at: input.started_at,
    finished_at,
    environment: input.environment,
  };
  const attempt: CapExecutionAttempt = { ...base, provenance_chain_hash: provenanceChainHash(base, []) };
  await getStorage().save(CAP_EXECUTION_ATTEMPTS_COLLECTION, attempt);

  // Update CAP status based on outcome
  if (input.resolution === "RESOLVED") {
    await updateCapStatus({
      cap_id: input.cap_id, status: "RESOLVED",
      resolution_note: `CAP-EXEC-01 · all 10 verifications passed · attempt ${input.attempt_id} · env=${input.environment}`,
      additional_evidence: [{ collection: CAP_EXECUTION_ATTEMPTS_COLLECTION, record_id: input.attempt_id, kind: "cap_execution_attempt" }],
    });
  } else if (input.resolution === "FAILED_EXECUTION") {
    // Founder-locked: failed execution → CAP stays OPEN (re-open from IN_PROGRESS)
    await updateCapStatus({
      cap_id: input.cap_id, status: "OPEN",
      resolution_note: `CAP-EXEC-01 attempt ${input.attempt_id} failed · ${input.reason.slice(0, 300)}`,
      additional_evidence: [{ collection: CAP_EXECUTION_ATTEMPTS_COLLECTION, record_id: input.attempt_id, kind: "cap_execution_attempt" }],
    });
  } else {
    // REFUSED (Broker denial etc.) — CAP goes back to PROPOSED with the refusal reason
    await updateCapStatus({
      cap_id: input.cap_id, status: "PROPOSED",
      resolution_note: `CAP-EXEC-01 refused: ${input.reason.slice(0, 300)}`,
    });
  }

  return { attempt, outcome: input.resolution, reason: input.reason };
}

export async function loadRecentExecutionAttempts(limit = 50): Promise<CapExecutionAttempt[]> {
  return getStorage().query<CapExecutionAttempt>(CAP_EXECUTION_ATTEMPTS_COLLECTION, {
    limit, order_by: "finished_at", order_dir: "desc",
  }).catch(() => []);
}
