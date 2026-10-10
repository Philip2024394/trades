// NEX1 · Cognitive Boundary Bridge · 2026-09-19
//
// Founder-locked. Ledger B additive. Zero LLM. Zero new brain. Zero new
// agent identity. Zero new daemon. Zero new memory store. Zero
// autonomous execution.
//
// Purpose: The smallest deterministic translation function that lets
// an NEX1_NATIVE chat-turn cognitive result — WHEN EXPLICITLY
// CLASSIFIED AS "GOVERNED_PROPOSAL" — be represented in the exact
// CapEngineeringProposal envelope shape that the existing NEX2 review
// pipeline consumes.
//
// Governance contract (audited before implementation):
//   1. Not a brain — no observation, no interpretation, no learning.
//   2. Not an authority — never signs, never grants execution.
//   3. Not a daemon — pure function, no runtime activation.
//   4. Not autonomous — refuses to build a proposal unless the caller
//      supplies an EXPLICIT classification == "GOVERNED_PROPOSAL".
//   5. Not a memory system — no side effects, no persistence.
//   6. Preserves anti-collusion — bridge output is UNSIGNED; NEX2 signs
//      its own review with its own key; NEX3 signs its own arbitration
//      with its own key. Bridge cannot forge either.
//   7. Preserves correlation integrity — receipt carries turn_id,
//      proposal_id, cap_id, mission_id (when applicable), so the chain
//      NEX1_NATIVE → proposal → NEX2 → NEX3 → Founder is traceable end
//      to end.
//   8. Determinism — same input produces byte-identical proposal_id
//      (derived from sha256 of turn_id + request_hash + cap_id).
//   9. authorised_workstation_scope is ALWAYS null on bridge output.
//      The founder is the only authority that may attach scope, via the
//      existing attachWorkstationScopeToProposal path in nex1-engineer.
//  10. founder_signature_slot is ALWAYS null on bridge output. Founder
//      signs at the Authority Broker gate, not here.
//
// Downstream consumers (unchanged behaviour):
//   - nex2ReviewCompute (pure) consumes the proposal envelope directly.
//   - nex3ArbitrationCompute (pure) consumes the NEX2 review verdict.
//   - Both continue to sign with their own independent Ed25519 keypairs.
//
// This module does NOT run the daemons. Callers may invoke the pure
// compute functions themselves for testing or preview. Persistence
// still goes through the founder-authorised gate.

import { createHash } from "node:crypto";
import { provenanceChainHash } from "@/lib/nex-intelligence/provenance";
import type { CapEngineeringProposal } from "@/lib/nex-cap/nex1-engineer";

export const NEX1_NATIVE_PROPOSAL_BRIDGE_VERSION =
  "nex1-native-proposal-bridge.v1.2026-09-19" as const;

// ── Cognitive classification (caller decides) ─────────────────────────

/** Two-way switch. Bridge refuses NORMAL_CHAT. The classification MUST
 *  arrive at the bridge as an EXPLICIT flag from the caller — the
 *  bridge does not itself decide whether a chat turn is governed. */
export type Nex1NativeCognitiveClassification =
  | "NORMAL_CHAT"
  | "GOVERNED_PROPOSAL";

/** The subset of NEX1_NATIVE chat-turn cognitive state that this
 *  bridge is willing to represent. Deliberately narrow — no raw
 *  utterance text, no micro-brain output, no verifier verdicts. Those
 *  stay in the chat-turn subsystem. */
export interface Nex1NativeCognitiveResult {
  readonly turn_id: string;
  readonly request_hash: string;
  readonly classification: Nex1NativeCognitiveClassification;
  readonly diagnosis: string;                 // ≥ 10 chars or NEX2 rejects
  readonly proposed_fix_summary: string;      // ≥ 10 chars or NEX2 rejects
  readonly evidence_refs: readonly string[];  // NEX2 rejects empty
  readonly resolver_outcome: "PROPOSE" | "ESCALATE";
}

// ── Bridge input / output ────────────────────────────────────────────

export interface Nex1NativeProposalBridgeInput {
  readonly cognitive_result: Nex1NativeCognitiveResult;
  readonly cap_id: string;                    // caller-supplied · not fabricated
  readonly mission_id: string | null;         // optional correlation to NEX1-runtime03
}

export type BridgeRefusalReason =
  | "CLASSIFICATION_NORMAL_CHAT"
  | "DIAGNOSIS_TOO_SHORT"
  | "FIX_SUMMARY_TOO_SHORT"
  | "EMPTY_EVIDENCE_REFS"
  | "MISSING_CAP_ID"
  | "MISSING_TURN_ID"
  | "MISSING_REQUEST_HASH";

export interface Nex1NativeProposalBridgeReceipt {
  readonly bridge_version: typeof NEX1_NATIVE_PROPOSAL_BRIDGE_VERSION;
  readonly bridged: boolean;
  readonly refusal_reason: BridgeRefusalReason | null;
  readonly proposal: CapEngineeringProposal | null;
  readonly correlation: {
    readonly turn_id: string | null;
    readonly proposal_id: string | null;
    readonly cap_id: string | null;
    readonly mission_id: string | null;
    readonly request_hash: string | null;
  };
  readonly created_at: string;                 // ISO
}

// ── Deterministic proposal_id derivation ──────────────────────────────

/** Deterministic proposal_id derived from turn_id + request_hash +
 *  cap_id. Same inputs → same proposal_id. Prefixed CAP-PROP-BRIDGE so
 *  bridge-originated proposals are distinguishable at audit time from
 *  runtime03-originated proposals (which use CAP-PROP-<cap_id>-uuid). */
export function deriveBridgedProposalId(
  turn_id: string,
  request_hash: string,
  cap_id: string,
): string {
  const canon = `${turn_id}|${request_hash}|${cap_id}`;
  const digest = createHash("sha256").update(canon, "utf8").digest("hex");
  return `CAP-PROP-BRIDGE-${digest.slice(0, 24)}`;
}

// ── Bridge · pure translation ─────────────────────────────────────────

/**
 * Pure deterministic translation from NEX1_NATIVE cognitive result to
 * a CapEngineeringProposal envelope.
 *
 * Refuses to build a proposal if:
 *   - classification is NORMAL_CHAT (default cognitive path)
 *   - diagnosis < 10 chars (NEX2 would reject)
 *   - proposed_fix_summary < 10 chars (NEX2 would reject)
 *   - evidence_refs is empty (NEX2 would reject)
 *   - cap_id / turn_id / request_hash is missing
 *
 * When bridged, produces:
 *   - proposal_id = deterministic sha256 slice
 *   - founder_signature_slot = null (P-U doctrine · founder signs, not us)
 *   - authorised_workstation_scope = null (attached only by founder)
 *   - evidence_chain = [cap_id, ...evidence_refs]
 *   - diagnosed_by_agent = "nex1-master-engineer" (existing enum · bridge
 *     does not invent a new agent identity)
 *   - created_at = ISO now
 *   - provenance_chain_hash = via existing provenanceChainHash
 *
 * The bridge does NOT invoke NEX2 or NEX3. It does NOT persist. It does
 * NOT sign anything. Caller decides what to do with the receipt.
 */
export function bridgeNex1NativeToProposal(
  input: Nex1NativeProposalBridgeInput,
): Nex1NativeProposalBridgeReceipt {
  const now = new Date().toISOString();
  const { cognitive_result, cap_id, mission_id } = input;

  // ── Refusal path · pre-conditions ───────────────────────────────────
  const refusal = detectRefusal(cognitive_result, cap_id);
  if (refusal !== null) {
    return {
      bridge_version: NEX1_NATIVE_PROPOSAL_BRIDGE_VERSION,
      bridged: false,
      refusal_reason: refusal,
      proposal: null,
      correlation: {
        turn_id: cognitive_result.turn_id || null,
        proposal_id: null,
        cap_id: cap_id || null,
        mission_id: mission_id,
        request_hash: cognitive_result.request_hash || null,
      },
      created_at: now,
    };
  }

  // ── Build proposal envelope ─────────────────────────────────────────
  const proposal_id = deriveBridgedProposalId(
    cognitive_result.turn_id,
    cognitive_result.request_hash,
    cap_id,
  );

  const evidence_chain: readonly string[] = Object.freeze(
    [cap_id, ...cognitive_result.evidence_refs],
  );

  const base = {
    record_type: "NEX_CAP_ENGINEERING_PROPOSAL" as const,
    proposal_id,
    cap_id,
    diagnosed_by_agent: "nex1-master-engineer" as const,
    diagnosis: cognitive_result.diagnosis,
    proposed_fix_summary: cognitive_result.proposed_fix_summary,
    required_authority_scope: {
      // Bridge default: no tool authority, no host authority, no
      // collection write authority. Founder MUST attach scope
      // separately via the existing authoring path.
      authorised_tools: Object.freeze([] as string[]) as readonly string[],
      authorised_hosts: Object.freeze([] as string[]) as readonly string[],
      authorised_collections_write: Object.freeze([] as string[]) as readonly string[],
      requires_founder_signature: true,
    },
    // P-U doctrine: bridge cannot attach workstation scope. If founder
    // decides this proposal should reach the workstation, they attach
    // scope via attachWorkstationScopeToProposal in nex1-engineer.
    authorised_workstation_scope: null,
    evidence_chain,
    resolver_outcome: cognitive_result.resolver_outcome,
    // P-U doctrine: bridge cannot sign as founder. Slot is always null.
    founder_signature_slot: null as null,
    created_at: now,
  };

  const proposal: CapEngineeringProposal = {
    ...base,
    provenance_chain_hash: provenanceChainHash(base, []),
  };

  return {
    bridge_version: NEX1_NATIVE_PROPOSAL_BRIDGE_VERSION,
    bridged: true,
    refusal_reason: null,
    proposal,
    correlation: {
      turn_id: cognitive_result.turn_id,
      proposal_id,
      cap_id,
      mission_id,
      request_hash: cognitive_result.request_hash,
    },
    created_at: now,
  };
}

// ── Refusal detection ─────────────────────────────────────────────────

function detectRefusal(
  cr: Nex1NativeCognitiveResult,
  cap_id: string,
): BridgeRefusalReason | null {
  if (cr.classification !== "GOVERNED_PROPOSAL") {
    return "CLASSIFICATION_NORMAL_CHAT";
  }
  if (!cr.turn_id || cr.turn_id.trim().length === 0) {
    return "MISSING_TURN_ID";
  }
  if (!cr.request_hash || cr.request_hash.trim().length === 0) {
    return "MISSING_REQUEST_HASH";
  }
  if (!cap_id || cap_id.trim().length === 0) {
    return "MISSING_CAP_ID";
  }
  if (!cr.diagnosis || cr.diagnosis.trim().length < 10) {
    return "DIAGNOSIS_TOO_SHORT";
  }
  if (!cr.proposed_fix_summary || cr.proposed_fix_summary.trim().length < 10) {
    return "FIX_SUMMARY_TOO_SHORT";
  }
  if (cr.evidence_refs.length === 0) {
    return "EMPTY_EVIDENCE_REFS";
  }
  return null;
}
