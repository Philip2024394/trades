// WO-NEX-RUNTIME-04 · NEX2 review types.
//
// Founder-locked 2026-09-13. NEX2 is architecturally distinct from
// NEX1. Its verdict is not a re-emission of NEX1's verdict; it is an
// INDEPENDENT judgement produced by a separate process signing with a
// separate key.

export type Nex2Verdict =
  | "INDEPENDENTLY_VERIFIED"
  | "REJECTED_UNSAFE"
  | "REJECTED_INCOMPLETE_EVIDENCE"
  | "CONFLICT_WITH_NEX1"
  | "ESCALATE_TO_FOUNDER"
  | "INSUFFICIENT_REVIEW_INPUT";

/** A specific reviewable-item failure detected by NEX2. Contributes to
 *  the verdict. Multiple findings may accompany a single review. */
export type Nex2FindingKind =
  | "empty_evidence_chain"                        // proposal.evidence_chain is empty
  | "escalate_only_kind_not_escalated"            // security-critical kind but proposal_outcome != ESCALATE
  | "diagnosis_absent"                             // proposal.diagnosis is empty/whitespace
  | "fix_summary_absent"                           // proposal.proposed_fix_summary is empty
  | "workstation_scope_touches_protected_root"    // authorised scope covers protected substrate
  | "workstation_scope_missing_stages"            // scope declares fewer stages than the fix needs
  | "founder_signature_slot_not_null"             // proposal claims to already be authorised · impossible per P-U
  | "unsupported_cap_kind"                         // proposal references a CAP kind no resolver knows
  | "context_chain_missing"                        // NEX1 chain absent · NEX2 cannot review reasoning
  | "context_chain_no_observations"                // NEX1 chain has no observations
  | "context_chain_no_analysis"                    // NEX1 chain has no analysis
  | "context_chain_no_evidence"                    // NEX1 chain has no evidence_refs
  | "diagnosis_contradicts_cap_kind"               // e.g. diagnosis mentions "test masquerade" but CAP kind is a benign one
  | "cap_status_terminal";                         // CAP already RESOLVED/DISMISSED

export interface Nex2Finding {
  readonly kind: Nex2FindingKind;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly detail: string;
  readonly evidence_ref: string | null;
}

/** Persisted, agent-identity-signed review record. */
export interface Nex2ReviewRecord {
  readonly record_type: "NEX2_REVIEW";
  readonly review_id: string;
  readonly proposal_id: string;
  readonly cap_id: string | null;
  readonly mission_id: string | null;
  readonly nex1_context_id: string | null;
  readonly reviewed_by_agent_id: string;
  readonly reviewed_by_instance_id: string;
  readonly reviewed_by_public_key_der_hex: string;
  readonly reviewed_at: string;
  readonly verdict: Nex2Verdict;
  readonly findings: readonly Nex2Finding[];
  readonly reason_summary: string;
  readonly evidence_ref: string | null;
  readonly signature_hex: string;
}

export const NEX2_REVIEW_COLLECTION = "nex2_reviews" as const;

// ── Protected roots (never touched by an autonomous fix) ───────────────

/** These paths are protected substrate. If a proposal's
 *  authorised_workstation_scope covers any of them (exact match or
 *  directory-prefix), NEX2 rejects. */
export const NEX2_PROTECTED_ROOTS: readonly string[] = Object.freeze([
  "src/lib/nex-authority-broker/",
  "src/lib/nex-controlled-hands/",
  "src/lib/nex-cap/nex1-engineer.ts",
  "src/lib/nex1-orchestrator/wo2-authorization.ts",
  "src/lib/nex1-orchestrator/wo2-founder-keys.ts",
  "src/lib/nex1-orchestrator/wo13-",
  "src/lib/nex-agent-runtime/process/identity.ts",
  "src/lib/nex-agent-runtime/nex2/",              // NEX2 cannot rewrite itself
]);

// ── Security-critical CAP kinds (must always ESCALATE) ─────────────────

export const NEX2_ESCALATE_ONLY_CAP_KINDS: ReadonlySet<string> = new Set([
  "guardian.te.evidence_source_registry_untrusted",
  "guardian.te.evidence_source_test_masquerade",
]);
