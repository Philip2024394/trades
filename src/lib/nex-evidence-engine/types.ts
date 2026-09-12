// src/lib/nex-evidence-engine/types.ts
//
// NEX1 · EVIDENCE ENGINE · v0 · Phase 1
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Constitutional discipline:
//   · Evidence Engine measures · never decides
//   · NEX1Declaration ≠ EvidenceRecord (record_type is the distinguisher)
//   · Every EvidenceRecord carries tool + tool_version + reproducibility
//   · Never converts NOT_MEASURED to PASSED silently

export type EvidenceRecordType = "EVIDENCE_RECORD" | "NEX1_DECLARATION";

export type EvidenceDimension =
  | "compilation"       // E-01
  | "type_check"        // E-02
  | "tests"             // E-03
  | "regression"        // E-04
  | "complexity";       // E-05

export type EvidenceState =
  | "MEASURED"
  | "PASSED"
  | "FAILED"
  | "NOT_MEASURED"
  | "NOT_APPLICABLE"
  | "INCONCLUSIVE"
  | "BLOCKED"
  | "STALE";

export type CandidateId = "cand_nex1" | "cand_nex2" | "cand_baseline" | string;

export interface Measurement {
  readonly unit: string;                       // e.g. "count" · "seconds" · "boolean"
  readonly value: number | string | boolean | Record<string, unknown> | null;
  readonly precision?: string;                 // e.g. "integer" · "float2" · "exact"
  readonly method_id: string;                  // e.g. "tsc-no-emit" · "vitest-run" · "cyclomatic-ast-walk"
}

export interface ReproducibilityInformation {
  readonly command: string;                    // exact re-measurement command
  readonly cwd: string;                        // working directory
  readonly env_fingerprint: string;            // sha-256 prefix of relevant env vars
  readonly node_version?: string;
  readonly platform?: string;
  readonly seed?: number;
}

export interface Attribution {
  readonly external_llm_used: false;
  readonly deterministic: true;
  readonly taught_by: "master_ai_engineer";
  readonly role: "evidence_engine" | "nex1_builder";
  readonly authority: "measurement" | "declaration_only";
}

export interface Provenance {
  readonly requested_by: string;
  readonly produced_by: string;                // e.g. "evidence-engine@v0.1.0"
  readonly parent_records: readonly string[];
  readonly tool_chain: readonly { tool: string; tool_version: string }[];
  readonly chain_integrity_hash: string;
}

export interface EvidenceRecord {
  readonly record_type: "EVIDENCE_RECORD";     // constitutional distinguisher
  readonly evidence_id: string;
  readonly schema_version: string;
  readonly project_id: string;
  readonly work_order_id: string;
  readonly candidate_id: CandidateId;
  readonly evidence_type: EvidenceDimension;
  readonly state: EvidenceState;
  readonly measurement: Measurement | null;    // null when state ∈ {NOT_MEASURED, NOT_APPLICABLE, BLOCKED}
  readonly value: number | string | boolean | Record<string, unknown> | null;
  readonly baseline_value: number | string | boolean | null;
  readonly candidate_value: number | string | boolean | null;
  readonly delta: { absolute: number | null; sign: "+" | "-" | "0" | null; direction: "improvement" | "regression" | "neutral" | "unknown" } | null;
  readonly methodology: string;
  readonly tool: string;
  readonly tool_version: string;
  readonly timestamp: string;
  readonly source_files: readonly string[];
  readonly source_hashes: readonly { path: string; sha256_prefix: string }[];
  readonly reproducibility_information: ReproducibilityInformation;
  readonly limitations: string;
  readonly provenance: Provenance;
  readonly confidence: "high" | "medium" | "low" | "insufficient";
  readonly attribution: Attribution;
}

export interface NEX1Declaration {
  readonly record_type: "NEX1_DECLARATION";    // constitutional distinguisher
  readonly declaration_id: string;
  readonly schema_version: string;
  readonly work_order_id: string;
  readonly candidate_id: "cand_nex1";
  readonly claim_type:
    | "IMPLEMENTATION_COMPLETE"
    | "TESTS_EXPECTED_TO_PASS"
    | "SEMANTIC_PRESERVATION_CLAIMED"
    | "COMPLEXITY_EXPECTED_TO_IMPROVE"
    | "COMPILATION_EXPECTED"
    | "TYPE_CHECK_EXPECTED"
    | "CUSTOM";
  readonly claim_text: string;
  readonly self_reported_state: "CLAIMED" | "UNCERTAIN" | "WITHDRAWN";
  readonly at: string;
  readonly attribution: Attribution;
}

export interface EvidenceBundle {
  readonly record_type: "EVIDENCE_BUNDLE";
  readonly bundle_id: string;
  readonly schema_version: string;
  readonly work_order_id: string;
  readonly candidate_id: CandidateId;
  readonly at: string;
  readonly dimensions: Readonly<Record<EvidenceDimension, readonly string[]>>;    // evidence_ids per dimension
  readonly dimension_states: Readonly<Record<EvidenceDimension, EvidenceState>>;
  readonly baseline_bundle_id: string | null;
  readonly delta_summary: Readonly<Record<EvidenceDimension, { direction: "improvement" | "regression" | "neutral" | "unknown"; absolute: number | null }>>;
  readonly overall_confidence: "high" | "medium" | "low" | "insufficient";
  readonly unresolved_dimensions: readonly EvidenceDimension[];
  readonly provenance: Provenance;
  readonly attribution: Attribution;
}

export interface MeasurementInput {
  readonly work_order_id: string;
  readonly project_id: string;
  readonly candidate_id: CandidateId;
  readonly source_files: readonly { path: string; content: string }[];
  readonly baseline_files?: readonly { path: string; content: string }[];   // optional baseline for delta
  readonly requested_by: string;
}
