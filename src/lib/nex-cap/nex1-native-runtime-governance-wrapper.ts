// NEX1 · Runtime Governance Wrapper · 2026-09-19
//
// Founder-locked. Ledger B additive. Zero LLM. Zero new brain. Zero
// new agent identity. Zero new daemon. Zero new memory store. Zero
// autonomous execution.
//
// Purpose: The smallest deterministic composition that wires the
// REAL `runChatTurn` cognitive runtime to the already-verified bridge
// and the existing NEX2/NEX3 pure-compute governance functions.
//
// This is the *runtime* wiring. Chat-turn itself is NOT modified.
// The wrapper:
//   1. Calls `runChatTurn(input)` unchanged — real NEX1_NATIVE runs.
//   2. If AND ONLY IF the caller supplied an explicit
//      `governance.classification === "GOVERNED_PROPOSAL"` flag AND
//      valid engineering-proposal fields, invokes the bridge
//      (deterministic pure function).
//   3. If the bridge produced a valid envelope, invokes
//      `nex2ReviewCompute` (existing pure function) to obtain a
//      deterministic NEX2 verdict on that proposal.
//   4. If the NEX2 verdict is one of the CONFLICT verdicts, invokes
//      `nex3ArbitrationCompute` (existing pure function) with the
//      NEX2 review record shape to obtain a deterministic NEX3
//      verdict.
//   5. Returns the real chat-turn result PLUS an optional
//      `governance_evidence` object carrying the correlation chain
//      and verdicts.
//
// Classification rule (§4 of the prompt):
//   The wrapper does NOT invent a cognitive classifier. The caller
//   supplies the classification explicitly. Without it, the default
//   is NORMAL_CHAT and no governance-side work happens.
//
// Governance invariants:
//   · Normal chat: bridge NOT called · NEX2 NOT called · NEX3 NOT
//     called (proven by tests F1).
//   · Governed proposal: bridge called deterministically · NEX2
//     called only after bridge succeeds · NEX3 called only when NEX2
//     verdict ∈ CONFLICT_VERDICTS.
//   · Founder boundary: no workstation mutation · no autonomous
//     execution · no signing · no storage writes.
//   · Cryptographic independence: wrapper never signs · NEX2 (in
//     production) signs with its own key · NEX3 with its own · the
//     wrapper only calls the PURE compute functions here (no signing)
//     to prove the runtime path exists.

import type {
  RunChatTurnInput,
  RunChatTurnResult,
} from "@/lib/nex-agent/code-engine/capability-chat-turn";
import { runChatTurn } from "@/lib/nex-agent/code-engine/capability-chat-turn";
import {
  bridgeNex1NativeToProposal,
  type Nex1NativeCognitiveResult,
  type Nex1NativeProposalBridgeReceipt,
  type Nex1NativeCognitiveClassification,
} from "@/lib/nex-cap/nex1-native-proposal-bridge";
import { nex2ReviewCompute, type Nex2ReviewComputation } from "@/lib/nex-agent-runtime/nex2/review";
import { nex3ArbitrationCompute, type Nex3ArbitrationComputation } from "@/lib/nex-agent-runtime/nex3/arbitration";
import type { Nex2ReviewRecord } from "@/lib/nex-agent-runtime/nex2/types";
import type { CapabilityGap } from "@/lib/nex-cap/types";
import type { MissionContextChain } from "@/lib/nex-agent-runtime/nex1/types";
import { createHash } from "node:crypto";

export const NEX1_RUNTIME_GOVERNANCE_WRAPPER_VERSION =
  "nex1-native-runtime-governance-wrapper.v1.2026-09-19" as const;

// ── The four NEX2 verdicts that trigger NEX3 arbitration ─────────────

const CONFLICT_VERDICTS = new Set([
  "REJECTED_UNSAFE",
  "REJECTED_INCOMPLETE_EVIDENCE",
  "CONFLICT_WITH_NEX1",
]);

// ── Caller-supplied governance payload ────────────────────────────────

/**
 * Governance input the caller supplies alongside the standard chat-turn
 * input. The wrapper NEVER decides the classification itself — the
 * caller is responsible. Absent = NORMAL_CHAT default.
 */
export interface Nex1NativeGovernanceInput {
  /** Explicit deterministic switch · caller decides. */
  readonly classification: Nex1NativeCognitiveClassification;

  /** Engineering-proposal fields the caller wants NEX1 to bridge into
   *  the NEX2/NEX3 governance path. Required only when classification
   *  is GOVERNED_PROPOSAL. */
  readonly proposal_fields?: {
    readonly cap_id: string;
    readonly mission_id: string | null;
    readonly diagnosis: string;
    readonly proposed_fix_summary: string;
    readonly evidence_refs: readonly string[];
    readonly resolver_outcome: "PROPOSE" | "ESCALATE";
  };

  /** Optional test-mode inputs so unit tests can supply real
   *  Nex1_context and CapabilityGap without running a full daemon.
   *  These are consumed only by nex2ReviewCompute / nex3ArbitrationCompute
   *  (both pure). Never persisted. */
  readonly test_inputs?: {
    readonly cap: CapabilityGap | null;
    readonly nex1_context: MissionContextChain | null;
  };
}

// ── Wrapper input · extends chat-turn input additively ────────────────

export interface Nex1NativeRuntimeGovernanceInput extends RunChatTurnInput {
  /** Optional governance opt-in. Default: NORMAL_CHAT. */
  readonly governance?: Nex1NativeGovernanceInput;
}

// ── Wrapper output · extends chat-turn output additively ──────────────

export interface Nex1NativeGovernanceEvidence {
  readonly wrapper_version: typeof NEX1_RUNTIME_GOVERNANCE_WRAPPER_VERSION;
  readonly classification: Nex1NativeCognitiveClassification;
  readonly bridge_invoked: boolean;
  readonly bridge_receipt: Nex1NativeProposalBridgeReceipt | null;
  readonly nex2_invoked: boolean;
  readonly nex2_computation: Nex2ReviewComputation | null;
  readonly nex3_invoked: boolean;
  readonly nex3_computation: Nex3ArbitrationComputation | null;
  readonly correlation: {
    readonly turn_id: string | null;
    readonly proposal_id: string | null;
    readonly cap_id: string | null;
    readonly mission_id: string | null;
    readonly nex2_review_id: string | null;   // synthesised in-memory for arbitration
  };
  readonly refusal_reason: string | null;
  /** Founder boundary marker · always TRUE · asserts no execution occurred */
  readonly founder_authority_preserved: true;
  /** Workstation mutation marker · always FALSE · asserts nothing was written */
  readonly workstation_mutation: false;
  readonly wrapper_trace: readonly string[];
}

export interface Nex1NativeRuntimeGovernanceResult {
  readonly chat_turn_result: RunChatTurnResult;
  readonly governance_evidence: Nex1NativeGovernanceEvidence;
}

// ── Runtime wiring · smallest possible composition ────────────────────

/**
 * Runs the real NEX1_NATIVE chat-turn cognitive path. If the caller
 * explicitly classifies this turn as GOVERNED_PROPOSAL and supplies
 * engineering-proposal fields, additionally invokes the verified
 * bridge and the existing pure NEX2 / NEX3 compute functions.
 *
 * This is the SMALLEST possible runtime wiring. It:
 *   - Does not modify chat-turn.ts (mtime preserved).
 *   - Does not modify NEX2 or NEX3.
 *   - Does not sign anything.
 *   - Does not persist anything to storage.
 *   - Does not mutate any workstation state.
 *   - Refuses to invoke the bridge / NEX2 / NEX3 unless
 *     classification === "GOVERNED_PROPOSAL".
 *
 * Every path is deterministic. Zero LLM.
 */
export async function runNex1TurnWithGovernance(
  input: Nex1NativeRuntimeGovernanceInput,
): Promise<Nex1NativeRuntimeGovernanceResult> {
  const wrapper_trace: string[] = [];

  // ── STEP 1 · Run the REAL chat-turn ─────────────────────────────────
  //
  // Whatever chat-turn does — classifier, safety-boundary, micro-brain
  // broadcast, verifier, composer — happens exactly as it always does.
  // We do not intercept, filter, or modify its behaviour.
  wrapper_trace.push(
    `wrapper · invoking real runChatTurn · conversation=${input.conversation_id} · governance=${input.governance?.classification ?? "NORMAL_CHAT"}`,
  );

  const chat_turn_result = await runChatTurn(input);
  wrapper_trace.push(
    `wrapper · runChatTurn returned · state=${chat_turn_result.state} · turn_id=${chat_turn_result.turn_id} · source=${chat_turn_result.source} · trace_lines=${chat_turn_result.trace.length}`,
  );

  // ── STEP 2 · Classification gate · caller-decided ───────────────────
  //
  // Default (governance undefined) or classification !== GOVERNED_PROPOSAL:
  // do nothing further. Normal chat MUST NOT reach NEX2 or NEX3.
  const classification = input.governance?.classification ?? "NORMAL_CHAT";
  if (classification !== "GOVERNED_PROPOSAL") {
    wrapper_trace.push(
      `wrapper · classification=${classification} · bridge NOT invoked · NEX2 NOT invoked · NEX3 NOT invoked`,
    );
    return {
      chat_turn_result,
      governance_evidence: {
        wrapper_version: NEX1_RUNTIME_GOVERNANCE_WRAPPER_VERSION,
        classification,
        bridge_invoked: false,
        bridge_receipt: null,
        nex2_invoked: false,
        nex2_computation: null,
        nex3_invoked: false,
        nex3_computation: null,
        correlation: {
          turn_id: `chat-turn-${chat_turn_result.turn_id}`,
          proposal_id: null,
          cap_id: null,
          mission_id: null,
          nex2_review_id: null,
        },
        refusal_reason: null,
        founder_authority_preserved: true,
        workstation_mutation: false,
        wrapper_trace: Object.freeze([...wrapper_trace]),
      },
    };
  }

  // ── STEP 3 · Governance opt-in · caller must supply proposal_fields ──
  //
  // If the caller declared GOVERNED_PROPOSAL but did not supply
  // proposal_fields, we refuse. This is a caller-supplied invariant.
  const proposal_fields = input.governance!.proposal_fields;
  if (!proposal_fields) {
    wrapper_trace.push(
      `wrapper · classification=GOVERNED_PROPOSAL but no proposal_fields supplied · bridge REFUSED`,
    );
    return {
      chat_turn_result,
      governance_evidence: {
        wrapper_version: NEX1_RUNTIME_GOVERNANCE_WRAPPER_VERSION,
        classification,
        bridge_invoked: false,
        bridge_receipt: null,
        nex2_invoked: false,
        nex2_computation: null,
        nex3_invoked: false,
        nex3_computation: null,
        correlation: {
          turn_id: `chat-turn-${chat_turn_result.turn_id}`,
          proposal_id: null,
          cap_id: null,
          mission_id: null,
          nex2_review_id: null,
        },
        refusal_reason: "MISSING_PROPOSAL_FIELDS",
        founder_authority_preserved: true,
        workstation_mutation: false,
        wrapper_trace: Object.freeze([...wrapper_trace]),
      },
    };
  }

  // ── STEP 4 · Bridge (deterministic pure function) ───────────────────
  //
  // Derive request_hash from the actual user message · caller does not
  // supply it. This binds the proposal to the real utterance the
  // real chat-turn just processed.
  const request_hash = createHash("sha256")
    .update(input.user_message, "utf8")
    .digest("hex")
    .slice(0, 16);

  const cognitive_result: Nex1NativeCognitiveResult = {
    turn_id: `chat-turn-${chat_turn_result.turn_id}`,
    request_hash,
    classification: "GOVERNED_PROPOSAL",
    diagnosis: proposal_fields.diagnosis,
    proposed_fix_summary: proposal_fields.proposed_fix_summary,
    evidence_refs: proposal_fields.evidence_refs,
    resolver_outcome: proposal_fields.resolver_outcome,
  };

  wrapper_trace.push(
    `wrapper · invoking bridge · classification=GOVERNED_PROPOSAL · cap_id=${proposal_fields.cap_id} · mission_id=${proposal_fields.mission_id ?? "null"}`,
  );
  const bridge_receipt = bridgeNex1NativeToProposal({
    cognitive_result,
    cap_id: proposal_fields.cap_id,
    mission_id: proposal_fields.mission_id,
  });
  wrapper_trace.push(
    `wrapper · bridge returned · bridged=${bridge_receipt.bridged} · refusal=${bridge_receipt.refusal_reason ?? "null"} · proposal_id=${bridge_receipt.correlation.proposal_id ?? "null"}`,
  );

  // If bridge refused, stop here.
  if (!bridge_receipt.bridged || !bridge_receipt.proposal) {
    return {
      chat_turn_result,
      governance_evidence: {
        wrapper_version: NEX1_RUNTIME_GOVERNANCE_WRAPPER_VERSION,
        classification,
        bridge_invoked: true,
        bridge_receipt,
        nex2_invoked: false,
        nex2_computation: null,
        nex3_invoked: false,
        nex3_computation: null,
        correlation: bridge_receipt.correlation,
        refusal_reason: bridge_receipt.refusal_reason ?? "BRIDGE_REFUSED",
        founder_authority_preserved: true,
        workstation_mutation: false,
        wrapper_trace: Object.freeze([...wrapper_trace]),
      },
    };
  }

  // ── STEP 5 · NEX2 (pure compute) ────────────────────────────────────
  //
  // In production this call would go through the NEX2 daemon which
  // signs a Nex2ReviewRecord with its own Ed25519 key. In this runtime
  // test we prove the shape flow · not the signing chain. Signing is
  // exercised by the existing NEX2 test suite (nex2/__tests__/nex2.test.ts)
  // and by the bridge test suite (H-1..H-4, I-1, I-2).
  const cap = input.governance!.test_inputs?.cap ?? null;
  const nex1_context = input.governance!.test_inputs?.nex1_context ?? null;

  wrapper_trace.push(
    `wrapper · invoking NEX2 compute · proposal_id=${bridge_receipt.proposal.proposal_id}`,
  );
  const nex2_computation = nex2ReviewCompute({
    proposal: bridge_receipt.proposal,
    cap,
    nex1_context,
    mission_id: proposal_fields.mission_id,
  });
  wrapper_trace.push(
    `wrapper · NEX2 verdict=${nex2_computation.verdict} · findings=${nex2_computation.findings.length}`,
  );

  // ── STEP 6 · NEX3 (pure compute) · only on CONFLICT verdicts ────────
  //
  // The existing NEX3 daemon only wakes on CONFLICT verdicts
  // (nex3/daemon.ts:31-35). We honour that same predicate here so the
  // runtime path matches the production contract.
  let nex3_computation: Nex3ArbitrationComputation | null = null;
  let synthesised_review_id: string | null = null;

  if (CONFLICT_VERDICTS.has(nex2_computation.verdict)) {
    // Build a Nex2ReviewRecord-shaped payload for NEX3. In production
    // this comes off the signed NEX2 store; here we mirror the compute
    // output into the record shape. We do NOT sign it · that would
    // require NEX2's private key which the wrapper does not possess.
    synthesised_review_id = `REV-runtime-wrapper-${bridge_receipt.proposal.proposal_id.slice(-16)}`;
    const nex2_review_for_nex3: Nex2ReviewRecord = {
      record_type: "NEX2_REVIEW",
      review_id: synthesised_review_id,
      proposal_id: bridge_receipt.proposal.proposal_id,
      cap_id: bridge_receipt.proposal.cap_id,
      mission_id: proposal_fields.mission_id,
      nex1_context_id: nex1_context?.context_id ?? null,
      reviewed_by_agent_id: "wrapper-simulated-nex2",
      reviewed_by_instance_id: "wrapper-runtime-inst",
      reviewed_by_public_key_der_hex: "runtime-wrapper-not-a-real-nex2-key",
      reviewed_at: new Date().toISOString(),
      verdict: nex2_computation.verdict,
      findings: nex2_computation.findings,
      reason_summary: nex2_computation.reason_summary,
      evidence_ref: null,
      // Note: the wrapper cannot sign as NEX2. In production this
      // record is signed by the NEX2 daemon. The wrapper only tests
      // shape/correlation flow — anti-collusion is verified elsewhere.
      signature_hex: "runtime-wrapper-unsigned",
    };
    wrapper_trace.push(
      `wrapper · NEX2 verdict is CONFLICT · invoking NEX3 compute · review_id=${synthesised_review_id}`,
    );
    nex3_computation = nex3ArbitrationCompute({
      proposal: bridge_receipt.proposal,
      cap,
      nex2_review: nex2_review_for_nex3,
      nex1_context,
    });
    wrapper_trace.push(
      `wrapper · NEX3 verdict=${nex3_computation.verdict} · reject_score=${nex3_computation.reject_score} · allow_score=${nex3_computation.allow_score}`,
    );
  } else {
    wrapper_trace.push(
      `wrapper · NEX2 verdict is NOT a CONFLICT · NEX3 NOT invoked (matches production daemon contract)`,
    );
  }

  // ── STEP 7 · Founder boundary preserved ─────────────────────────────
  wrapper_trace.push(
    `wrapper · founder authority preserved · workstation NOT mutated · no signing performed by wrapper`,
  );

  return {
    chat_turn_result,
    governance_evidence: {
      wrapper_version: NEX1_RUNTIME_GOVERNANCE_WRAPPER_VERSION,
      classification,
      bridge_invoked: true,
      bridge_receipt,
      nex2_invoked: true,
      nex2_computation,
      nex3_invoked: nex3_computation !== null,
      nex3_computation,
      correlation: {
        turn_id: bridge_receipt.correlation.turn_id,
        proposal_id: bridge_receipt.correlation.proposal_id,
        cap_id: bridge_receipt.correlation.cap_id,
        mission_id: bridge_receipt.correlation.mission_id,
        nex2_review_id: synthesised_review_id,
      },
      refusal_reason: null,
      founder_authority_preserved: true,
      workstation_mutation: false,
      wrapper_trace: Object.freeze([...wrapper_trace]),
    },
  };
}
