// WO-NEX-RUNTIME-05 · NEX3 arbitration types.
//
// Founder-locked 2026-09-13. NEX3 arbitrates a specific disagreement
// between NEX1 (proposer) and NEX2 (reviewer). It is NOT a general
// reviewer, NOT a vote counter, and does NOT hold execution authority.
//
// NEX3's decision mechanism is DIFFERENT from NEX2's checklist:
// severity-weighted evaluation of NEX2's findings + evidence-quality
// scoring of NEX1's chain + risk-asymmetry rule for security-critical
// CAPs.

export type Nex3Verdict =
  | "ALLOW"                  // NEX1's proposal is sound · NEX2's concerns not decisive
  | "REJECT"                 // NEX2's rejection is upheld with independent reasoning
  | "ESCALATE_TO_FOUNDER"    // arbitrator cannot decide · founder-only
  | "INSUFFICIENT_INPUT";    // arbitrator lacks material to decide

export type Nex3SignalKind =
  | "nex2_critical_finding_present"
  | "nex2_high_finding_evidence_gap"
  | "nex2_high_finding_diagnosis_gap"
  | "nex2_medium_findings_only"
  | "nex1_chain_complete"
  | "nex1_chain_incomplete"
  | "cap_security_sensitive"
  | "cap_priority_critical"
  | "risk_asymmetry_reject"          // security-critical CAP with any critical finding
  | "evidence_chain_length"
  | "deterministic_template_match"   // CAP kind maps to a known resolver template
  | "unrepeatable_review_input";     // review inputs missing → cannot arbitrate

export interface Nex3ArbitrationSignal {
  readonly kind: Nex3SignalKind;
  readonly polarity: "supports_reject" | "supports_allow" | "gate_reject" | "gate_escalate" | "informational";
  readonly weight: number;                     // signed contribution to arbitration score
  readonly detail: string;
  readonly evidence_ref: string | null;
}

/** Persisted, agent-signed arbitration record. */
export interface Nex3ArbitrationRecord {
  readonly record_type: "NEX3_ARBITRATION";
  readonly arbitration_id: string;
  readonly proposal_id: string;
  readonly cap_id: string | null;
  readonly nex2_review_id: string | null;
  readonly nex1_context_id: string | null;
  readonly arbitrated_by_agent_id: string;
  readonly arbitrated_by_instance_id: string;
  readonly arbitrated_by_public_key_der_hex: string;
  readonly arbitrated_at: string;
  readonly verdict: Nex3Verdict;
  readonly signals: readonly Nex3ArbitrationSignal[];
  readonly reject_score: number;               // sum of supports_reject weights
  readonly allow_score: number;                // sum of supports_allow weights
  readonly reason_summary: string;
  readonly signature_hex: string;
}

export const NEX3_ARBITRATION_COLLECTION = "nex3_arbitrations" as const;

// ── Risk-asymmetry gates (founder-locked) ──────────────────────────────

/** If the CAP is any of these kinds AND NEX2 raised any CRITICAL
 *  finding, NEX3 MUST REJECT regardless of other signals. */
export const NEX3_SECURITY_CRITICAL_CAP_KINDS: ReadonlySet<string> = new Set([
  "guardian.te.evidence_source_registry_untrusted",
  "guardian.te.evidence_source_test_masquerade",
]);
