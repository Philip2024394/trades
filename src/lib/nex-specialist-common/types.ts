// src/lib/nex-specialist-common/types.ts
//
// Shared types used across every NEX evidence specialist.
// Every specialist record MUST satisfy this base shape to pass Evidence Validation.

export interface ReproducibilityInformation {
  readonly command: string;
  readonly cwd: string;
  readonly env_fingerprint: string;
  readonly node_version: string;
  readonly platform: string;
  readonly seed: string;
}

export interface DeterminismWitness {
  readonly first_run_hash: string;
  readonly second_run_hash: string;
  readonly identical: boolean;
}

export interface ByteIdentityWitness {
  readonly before_hash: string;
  readonly after_hash: string;
  readonly drift_count: number;
  readonly drifted: readonly string[];
}

export interface SpecialistBaseRecord {
  readonly record_type: string;
  readonly schema_version: string;
  readonly session_id: string;
  readonly outcome: string;
  readonly outcome_reason: string;
  readonly reproducibility_information: ReproducibilityInformation;
  readonly determinism_witness: DeterminismWitness;
  readonly byte_identity_witness: ByteIdentityWitness;
  readonly limitations: string;
  readonly authorisation: false;
  readonly execution: false;
  readonly authority_boundary: string;
  readonly attribution: {
    readonly external_llm_used: false;
    readonly deterministic: true;
    readonly taught_by: "master_ai_engineer";
    readonly role: string;
    readonly authority: string;
    readonly produced_by: string;
  };
  readonly at: string;
  readonly evidence_pool_ids: readonly string[];
}
