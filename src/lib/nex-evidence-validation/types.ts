// src/lib/nex-evidence-validation/types.ts
//
// NEX Evidence Validation Layer · types only.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12 as pre-Phase-5 correction C-2.
//
// Sits between EVERY Evidence Specialist and NEX2 consumption.
// Produces AuthoritativeEvidenceRecord only when all seven checks pass.
// A REJECTED verdict is a first-class successful outcome.

export type CheckId =
  | "schema"
  | "provenance"
  | "reproducibility"
  | "hash_integrity"
  | "scope"
  | "stale"
  | "authorisation_state";

export type CheckResult = "pass" | "fail";

export type ValidationVerdict =
  | "VALIDATED"
  | "REJECTED_SCHEMA"
  | "REJECTED_PROVENANCE"
  | "REJECTED_REPRODUCIBILITY"
  | "REJECTED_HASH"
  | "REJECTED_SCOPE"
  | "REJECTED_STALE"
  | "REJECTED_AUTHORISATION"
  | "REJECTED_MULTIPLE";

export interface ValidatorAttribution {
  readonly external_llm_used: false;
  readonly deterministic: true;
  readonly taught_by: "master_ai_engineer";
  readonly role: "evidence_validator";
  readonly authority: "validation_only";
  readonly produced_by: "nex_evidence_validation_layer";
}

export interface CheckOutcome {
  readonly check_id: CheckId;
  readonly result: CheckResult;
  readonly detail: string;
}

export interface AuthoritativeEvidenceRecord {
  readonly record_type: "AUTHORITATIVE_EVIDENCE_RECORD";
  readonly authoritative_evidence_id: string;
  readonly schema_version: string;                   // "v0.1.0"
  readonly source_record_type: string;               // e.g. "DEBUGGER_EVIDENCE"
  readonly source_record_id: string;                 // the specialist's session/evidence id
  readonly source_produced_by: string;
  readonly validation_verdict: ValidationVerdict;
  readonly check_results: readonly CheckOutcome[];
  readonly cited_input_hashes: readonly string[];
  readonly provenance_chain: {
    readonly source_specialist: string;
    readonly source_record_id: string;
    readonly validator_run_id: string;
    readonly fully_resolvable: boolean;
  };
  readonly chain_integrity_hash: string;
  readonly recorded_at: string;                      // ISO-8601 · excluded from deterministic signature
  readonly authorisation: false;
  readonly execution: false;
  readonly authority_boundary: "authoritative_evidence_readonly";
  readonly attribution: ValidatorAttribution;
}

// Minimum-shape contract that any specialist record must satisfy for validation.
export interface SpecialistRecordShape {
  readonly record_type: string;
  readonly schema_version?: string;
  readonly session_id?: string;
  readonly attribution?: {
    readonly external_llm_used?: boolean;
    readonly deterministic?: boolean;
    readonly role?: string;
    readonly authority?: string;
    readonly produced_by?: string;
  };
  readonly authorisation?: unknown;
  readonly execution?: unknown;
  readonly authority_boundary?: string;
  readonly reproducibility_information?: {
    readonly command?: string;
    readonly cwd?: string;
    readonly env_fingerprint?: string;
    readonly node_version?: string;
    readonly platform?: string;
    readonly seed?: string;
  };
  readonly determinism_witness?: {
    readonly first_run_hash?: string;
    readonly second_run_hash?: string;
    readonly identical?: boolean;
  };
  readonly byte_identity_witness?: unknown;
  readonly limitations?: string;
  readonly evidence_pool_ids?: readonly string[];
  readonly at?: string;
  // Passthrough for other fields · we do not restrict specialist-specific structure
  readonly [k: string]: unknown;
}
