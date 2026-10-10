// WO-NEX-RUNTIME-10 · workstation integration · types.
//
// Founder-locked 2026-09-14. This module is a CONNECTOR — not a second
// Authority Broker. Its job:
//
//     verify → construct execution bundle → hand off → observe → record
//
// The existing WO-04 Authority Broker remains THE FINAL deterministic
// file-mutation gate. RUNTIME-10 refuses execution unless:
//
//   1. Orchestrator gate receipt is WORKSTATION_ALLOWED
//   2. Receipt deep-verifies (assembly signature + every backing signature)
//   3. Receipt is signed by an identity in the trusted-orchestrator set
//   4. Founder delegation + NEX delegated authorization together AUTHORISE
//      the proposal (RUNTIME-08 combined verifier)
//   5. Scope hash matches across proposal ↔ authorization ↔ receipt
//   6. proposal_id matches across receipt ↔ authorization ↔ proposal
//   7. CAP-kind bridge is available for the proposal
//
// On any failure, execution is REFUSED · a signed refusal attestation is
// persisted · WO-04 is never invoked. On success, executeCapProposal runs
// the real WO-01…WO-09 chain with the real workstation adapter · the
// signed EXECUTED attestation cross-references every input artefact.

export type WorkstationIntegrationVerdict =
  | "EXECUTED"                           // full chain proceeded through WO-01..WO-09
  | "REFUSED_RECEIPT_NOT_ALLOWED"        // receipt.overall_verdict !== WORKSTATION_ALLOWED
  | "REFUSED_RECEIPT_INVALID"            // deep signature verification failed
  | "REFUSED_ORCHESTRATOR_UNTRUSTED"     // receipt not signed by any trusted orchestrator identity
  | "REFUSED_DELEGATION_INVALID"         // delegation/authorization not AUTHORISED
  | "REFUSED_PROPOSAL_MISMATCH"          // proposal_id disagreement across artefacts
  | "REFUSED_SCOPE_MISSING"              // proposal.authorised_workstation_scope is null
  | "REFUSED_SCOPE_MISMATCH"             // scope hash disagreement across artefacts
  | "REFUSED_UNSUPPORTED_CAP_KIND"       // bridge does not support this CAP kind
  | "REFUSED_BRIDGE_FAILED";             // buildCapExecutionBridge returned !ok

export interface WorkstationIntegrationCheck {
  readonly check: string;
  readonly ok: boolean;
  readonly detail: string;
}

/** A signed record of one RUNTIME-10 attempt. Every EXECUTED and every
 *  REFUSED attempt produces one of these. Signed by the requesting
 *  agent's own identity (not the founder, not the workstation). */
export interface WorkstationExecutionAttestation {
  readonly record_type: "NEX_WORKSTATION_EXECUTION_ATTESTATION";
  readonly attestation_id: string;
  readonly receipt_id: string;
  readonly delegation_id: string;
  readonly authorization_id: string;
  readonly proposal_id: string;
  readonly cap_id: string | null;
  readonly verdict: WorkstationIntegrationVerdict;
  readonly cap_execution_attempt_id: string | null;
  readonly cap_execution_outcome: "RESOLVED" | "REFUSED" | "FAILED_EXECUTION" | null;
  readonly checks: readonly WorkstationIntegrationCheck[];
  readonly reason_summary: string;
  readonly requester_agent_id: string;
  readonly requester_public_key_der_hex: string;
  readonly attested_at: string;
  readonly signature_hex: string;
}

export const WORKSTATION_INTEGRATION_ATTESTATION_COLLECTION = "nex_workstation_integration_attestations" as const;
