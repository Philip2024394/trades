// src/lib/nex-project-profile/types.ts
//
// NEX1 · PROJECT PROFILE · Phase 2A · type definitions.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Descriptive · not prescriptive. Read-only. No external LLM.

export type ProfileConfidence = "OBSERVED" | "STRONGLY_INFERRED" | "WEAKLY_INFERRED" | "UNKNOWN" | "CONFLICTING";

export interface EvidenceHash { readonly path: string; readonly sha256_prefix: string; }

export interface ProfileSignal<T> {
  readonly value: T | null;
  readonly state: ProfileConfidence;
  readonly evidence_files: readonly string[];
  readonly evidence_hashes: readonly EvidenceHash[];
  readonly sample_size: number;
  readonly supporting_count: number;
  readonly counter_count: number;
  readonly detection_method: string;
  readonly notes?: string;
}

export interface ScanStats {
  readonly files_scanned: number;
  readonly files_excluded: number;
  readonly sample_caps: Readonly<Record<string, number>>;
  readonly sampling_methodology: string;
  readonly excluded_paths: readonly string[];
  readonly scanned_bytes: number;
  readonly elapsed_ms: number;
}

export interface IdentityBlock {
  readonly project_type: ProfileSignal<string>;              // "node.js" · "python" · "rust" · "mixed" · "unknown"
  readonly repository_structure: ProfileSignal<"monorepo" | "single_package" | "unknown">;
  readonly primary_languages: ProfileSignal<readonly string[]>;
  readonly secondary_languages: ProfileSignal<readonly string[]>;
  readonly detected_frameworks: ProfileSignal<readonly string[]>;
  readonly detected_build_systems: ProfileSignal<readonly string[]>;
  readonly detected_package_managers: ProfileSignal<readonly string[]>;
}

export interface OrganisationBlock {
  readonly source_directories: ProfileSignal<readonly string[]>;
  readonly test_directories: ProfileSignal<readonly string[]>;
  readonly configuration_directories: ProfileSignal<readonly string[]>;
  readonly generated_directories: ProfileSignal<readonly string[]>;
  readonly vendor_directories: ProfileSignal<readonly string[]>;
  readonly asset_directories: ProfileSignal<readonly string[]>;
}

export interface ToolingBlock {
  readonly package_manager: ProfileSignal<string>;
  readonly build_command_declared: ProfileSignal<string>;
  readonly test_command_declared: ProfileSignal<string>;
  readonly lint_configuration: ProfileSignal<string>;      // path to config file if any
  readonly formatter_configuration: ProfileSignal<string>;
  readonly type_checker_configuration: ProfileSignal<string>;
  readonly framework_configuration: ProfileSignal<readonly string[]>;
}

export interface StyleSignalsBlock {
  readonly indentation: ProfileSignal<"tabs" | "2_spaces" | "4_spaces" | "other">;
  readonly quote_convention: ProfileSignal<"single" | "double" | "backtick" | "mixed">;
  readonly semicolon_convention: ProfileSignal<"always" | "never" | "mixed">;
  readonly file_naming_pattern: ProfileSignal<"kebab-case" | "camelCase" | "PascalCase" | "snake_case" | "mixed">;
  readonly test_naming_pattern: ProfileSignal<".test.ts" | ".spec.ts" | "__tests__" | "test_" | "mixed" | "none_detected">;
}

export interface StructureSignalsBlock {
  readonly top_level_directory_counts: ProfileSignal<Readonly<Record<string, number>>>;
  readonly typical_source_file_location: ProfileSignal<string>;
  readonly typical_test_file_location: ProfileSignal<string>;
  readonly detected_index_files: ProfileSignal<number>;
  readonly detected_barrel_files: ProfileSignal<number>;
}

export interface ProjectProfile {
  readonly record_type: "PROJECT_PROFILE";
  readonly profile_id: string;
  readonly schema_version: string;
  readonly project_root: string;
  readonly scanned_at: string;
  readonly scan_stats: ScanStats;
  readonly identity: IdentityBlock;
  readonly organisation: OrganisationBlock;
  readonly tooling: ToolingBlock;
  readonly style_signals: StyleSignalsBlock;
  readonly structure_signals: StructureSignalsBlock;
  readonly conflicts: ReadonlyArray<{ topic: string; signals: readonly string[]; notes: string }>;
  readonly limitations: string;
  readonly byte_identity_witness: {
    readonly before_hash_prefix: string;
    readonly after_hash_prefix: string;
    readonly identical: boolean;
    readonly drifted: readonly string[];
  };
  readonly attribution: {
    readonly external_llm_used: false;
    readonly deterministic: true;
    readonly taught_by: "master_ai_engineer";
    readonly role: "project_profile_scanner";
    readonly authority: "descriptive_read_only";
  };
}
