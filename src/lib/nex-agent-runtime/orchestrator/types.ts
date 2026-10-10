// WO-NEX-RUNTIME-07 · Orchestrator types.
//
// Founder-locked 2026-09-13. The Orchestrator produces a machine-
// verifiable GateReceipt · assembling signed evidence from NEX1, NEX2,
// NEX3, Security, and the founder Ed25519 signature. It never sets any
// gate to VALID that the backing evidence does not support.
//
// The workstation (RUNTIME-10) independently re-verifies each gate
// against the originating agent's own public key.

export type GateKind =
  | "NEX1_VALID"           // proposal exists · well-formed · unsigned per P-U
  | "NEX2_VALID"           // review record present · verdict inspected
  | "NEX3_VALID"           // arbitration if conflict · else NA
  | "SECURITY_VALID"       // security veto = CLEARED
  | "FOUNDER_AUTH_VALID"   // founder Ed25519 signature verified against trusted keys
  | "SCOPE_VALID"          // authorised_workstation_scope hash matches
  | "WORKSTATION_ALLOWED"; // all above true + freshness + consistency

export type GateVerdict =
  | "VALID"       // gate passes
  | "INVALID"     // gate fails (specific reason recorded)
  | "NA"          // gate not required for this proposal (e.g. NEX3 when no conflict)
  | "MISSING"     // backing record not present
  | "EXPIRED";    // backing record too old

/** A single gate in the receipt. Includes the originating record's
 *  identity + signature so downstream verifiers can independently
 *  check it. */
export interface Gate {
  readonly kind: GateKind;
  readonly verdict: GateVerdict;
  readonly detail: string;                              // human-readable rationale
  readonly backing_record_id: string | null;             // e.g. proposal_id · review_id · veto_id
  readonly backing_agent_id: string | null;              // agent that produced the record
  readonly backing_public_key_der_hex: string | null;    // agent's Ed25519 SPKI DER hex
  readonly backing_signature_hex: string | null;         // signature on the backing record
  readonly backing_timestamp: string | null;             // ISO timestamp of the backing record
  readonly scope_hash: string | null;                    // scope hash (SCOPE_VALID / SECURITY_VALID)
  readonly evidence_refs: readonly string[];
  readonly expires_at: string | null;                    // freshness window
}

/** The full receipt. Orchestrator signs the receipt itself to attest to
 *  assembly integrity — NOT to the correctness of individual verdicts. */
export interface OrchestratorGateReceipt {
  readonly record_type: "NEX_ORCHESTRATOR_GATE_RECEIPT";
  readonly receipt_id: string;
  readonly mission_id: string | null;
  readonly proposal_id: string;
  readonly cap_id: string | null;
  readonly assembled_by_agent_id: string;
  readonly assembled_by_instance_id: string;
  readonly assembled_by_public_key_der_hex: string;
  readonly assembled_at: string;
  readonly gates: readonly Gate[];
  readonly overall_verdict: "WORKSTATION_ALLOWED" | "BLOCKED" | "PENDING_INPUT" | "EXPIRED";
  readonly reason_summary: string;
  readonly signature_hex: string;                         // Orchestrator's signature on the receipt (assembly integrity)
}

export const ORCHESTRATOR_RECEIPT_COLLECTION = "nex_orchestrator_receipts" as const;

// ── Freshness windows (founder-adjustable defaults) ────────────────────

export interface FreshnessPolicy {
  readonly nex1_proposal_max_age_ms: number;
  readonly nex2_review_max_age_ms: number;
  readonly nex3_arbitration_max_age_ms: number;
  readonly security_veto_max_age_ms: number;
}

export const DEFAULT_FRESHNESS: FreshnessPolicy = Object.freeze({
  nex1_proposal_max_age_ms:     24 * 60 * 60_000,   // 24h
  nex2_review_max_age_ms:       12 * 60 * 60_000,   // 12h
  nex3_arbitration_max_age_ms:  12 * 60 * 60_000,   // 12h
  security_veto_max_age_ms:      1 * 60 * 60_000,   // 1h (security must be recent)
});
