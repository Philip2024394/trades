// src/lib/nex-code-health/types.ts
//
// NEX1 · CODE HEALTH INTELLIGENCE · types only.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// DESCRIPTIVE ONLY. Measures. Never judges. Read-only.

export type HealthMetricKind =
  | "cyclomatic_complexity"
  | "file_size"
  | "line_counts"
  | "function_size"
  | "nesting_depth"
  | "duplication"
  | "api_surface"
  | "dependency_fan_in"
  | "dependency_fan_out"
  | "dependency_depth"
  | "unused_exports"
  | "test_relationship";

// ─────────────────────────────────────────────────────────────
// STATE-MODEL BOUNDARY (founder correction · Phase 2C · 2026-09-12)
//
// Code Health v0 uses a MEASUREMENT-SPECIFIC 6-state model.
// It DOES NOT redefine, modify, or replace the Evidence Engine
// v0 state vocabulary (which is 8-state:
// MEASURED · PASSED · FAILED · NOT_MEASURED · NOT_APPLICABLE ·
// INCONCLUSIVE · BLOCKED · STALE).
//
// Code Health omits PASSED / FAILED intentionally: measurements
// are not verdicts. Where a metric is not authoritatively
// obtainable in v0, Code Health emits NOT_MEASURED with a
// machine-readable reason · never a fabricated value.
// ─────────────────────────────────────────────────────────────

export type HealthState = "MEASURED" | "NOT_MEASURED" | "NOT_APPLICABLE" | "INCONCLUSIVE" | "BLOCKED" | "STALE";

export type MeasurementScope = "file" | "function" | "project" | "package";

export interface ReproducibilityInformation {
  readonly command: string;
  readonly cwd: string;
  readonly env_fingerprint: string;
  readonly node_version: string;
  readonly platform: string;
}

export interface HealthAttribution {
  readonly external_llm_used: false;
  readonly deterministic: true;
  readonly taught_by: "master_ai_engineer";
  readonly role: "code_health_measurement";
  readonly authority: "descriptive_read_only";
  readonly produced_by: "code_health_intelligence";
}

// Provenance of a delegated measurement · when Code Health consumes an
// authoritative value from another NEX subsystem rather than recomputing it.
export interface DelegatedFrom {
  readonly subsystem: string;              // e.g. "project_architecture_intelligence"
  readonly subsystem_version: string;      // e.g. "v0.1.0"
  readonly field_reference: string;        // e.g. "fan_in[node_id]"
  readonly upstream_report_id?: string;
  readonly upstream_node_id?: string;
}

export interface HealthMeasurement {
  readonly record_type: "CODE_HEALTH_MEASUREMENT";
  readonly metric_id: string;
  readonly schema_version: string;
  readonly kind: HealthMetricKind;
  readonly scope: MeasurementScope;
  readonly scope_target: string;
  readonly source_path: string;
  readonly source_hash: string;
  readonly state: HealthState;
  readonly value: number | Record<string, unknown> | null;
  readonly tool: string;
  readonly tool_version: string;
  readonly methodology: string;
  readonly reproducibility_information: ReproducibilityInformation;
  readonly limitations: string;
  readonly reason?: string;                    // machine-readable reason when state ∈ {INCONCLUSIVE · NOT_MEASURED · BLOCKED · NOT_APPLICABLE · STALE}
  readonly delegated_from?: DelegatedFrom;     // populated only when the value is authoritatively supplied by another NEX subsystem
  readonly attribution: HealthAttribution;
  readonly upstream_architecture_id?: string;  // when the metric reuses Project Architecture data
  readonly upstream_profile_id?: string;
}

export interface CodeHealthReport {
  readonly record_type: "CODE_HEALTH_REPORT";
  readonly report_id: string;
  readonly schema_version: string;
  readonly project_root: string;
  readonly scanned_at: string;
  readonly scan_stats: {
    readonly files_scanned: number;
    readonly files_excluded: number;
    readonly functions_analysed: number;
    readonly measurements_produced: number;
    readonly elapsed_ms: number;
    readonly methodology: string;
  };
  readonly measurements: readonly HealthMeasurement[];
  readonly determinism_witness: { readonly first_run_hash: string; readonly second_run_hash: string; readonly identical: boolean };
  readonly byte_identity_witness: { readonly before_hash: string; readonly after_hash: string; readonly files_examined: number; readonly drift_count: number; readonly drifted: readonly string[] };
  readonly limitations: string;
  readonly attribution: HealthAttribution;
}

// ─── Provenance ──────────────────────────────────────────────────

export type ChainStepKind = "claim" | "evidence_pointer" | "measurement" | "source" | "source_hash" | "tool" | "methodology" | "reproducibility";

export interface ChainStep {
  readonly step_kind: ChainStepKind;
  readonly step_id: string;
  readonly detail: Record<string, unknown>;
  readonly next_step_id: string | null;
}

export interface ProvenanceChain {
  readonly record_type: "PROVENANCE_CHAIN";
  readonly requested_id: string;
  readonly steps: readonly ChainStep[];
  readonly fully_resolvable: boolean;
  readonly broken_links: readonly string[];
  readonly chain_integrity_hash: string;
  readonly attribution: HealthAttribution;
}
