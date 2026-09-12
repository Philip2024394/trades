// src/lib/nex-code-intelligence/types.ts
//
// NEX1 · CODE INTELLIGENCE · type definitions.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// Registry-driven detection · deterministic · CI-1..CI-12.
// Detection is separate from transformation · a language in DETECTED does
// NOT imply FORMATTED or TRANSFORMED.

export type Confidence = "high" | "medium" | "low" | "ambiguous" | "unresolved";
export type Detector = "extension" | "basename" | "shebang" | "content" | "neighbour" | "manifest" | "explicit" | "mime";

export type CapabilityState = "DETECTED" | "PARSED" | "ANALYSED" | "FORMATTED" | "LINTED" | "TRANSFORMED" | "TESTED";

export type LanguageKind = "programming" | "markup" | "data" | "embedded";

export interface LanguageEntry {
  readonly id: string;
  readonly display_name: string;
  readonly kind: LanguageKind;
  readonly aliases: readonly string[];
  readonly extensions: readonly string[];
  readonly filenames: readonly string[];
  readonly shebangs: readonly string[];
  readonly dialects: readonly string[];
  readonly syntax_family: string;
  readonly config_files: readonly string[];
  readonly package_managers: readonly string[];
  readonly toolchain?: Readonly<Record<string, string>>;
  readonly embeds_language?: string;
  readonly capability: Readonly<Partial<Record<CapabilityState, boolean>>>;
}

export interface Registry {
  readonly version: string;
  readonly notes: string;
  readonly capability_states: readonly { id: CapabilityState; definition: string }[];
  readonly languages: readonly LanguageEntry[];
  readonly special_basenames: ReadonlyArray<{ name: string; language: string; confidence_boost: string; role?: string }>;
  readonly generated_markers: ReadonlyArray<{ regex: string; confidence: Confidence }>;
  readonly vendor_path_markers: readonly string[];
}

export interface EvidenceEntry {
  readonly detector: Detector;
  readonly value: string;
  readonly rule_reference?: string;
}

export interface DetectionResult<T = string> {
  readonly detected_value: T | null;
  readonly candidates: readonly T[];
  readonly evidence: readonly EvidenceEntry[];
  readonly confidence: Confidence;
  readonly rationale: string;
  readonly deterministic: true;
}

export interface FileIntelligence {
  readonly filename: string;
  readonly path: string;
  readonly extension: string | null;
  readonly basename: string;
  readonly encoding: "utf-8" | "utf-16" | "unknown-8bit" | "binary";
  readonly line_ending: "lf" | "crlf" | "cr" | "mixed" | "none";
  readonly is_binary: boolean;
  readonly is_generated: boolean;
  readonly is_vendored: boolean;
  readonly content_hash: string;                 // sha-256 · 12-char prefix
  readonly language: DetectionResult<string>;
  readonly dialect: DetectionResult<string>;
  readonly capability_status: Readonly<Partial<Record<CapabilityState, boolean>>>;
  readonly attribution: { readonly external_llm_used: false; readonly deterministic: true; readonly taught_by: "master_ai_engineer" };
}

export interface ProjectMarker {
  readonly kind: "package_manager" | "build_system" | "test_system" | "framework" | "runtime" | "compiler" | "formatter" | "linter" | "type_checker" | "config" | "ci";
  readonly value: string;
  readonly evidence_path: string;
  readonly rule_reference?: string;
}

export interface ProjectProfile {
  readonly root: string;
  readonly detected_markers: readonly ProjectMarker[];
  readonly primary_languages: readonly { language: string; file_count: number; confidence: Confidence }[];
  readonly style: {
    readonly indentation: DetectionResult<"tabs" | "2_spaces" | "4_spaces" | "other">;
    readonly quote_convention: DetectionResult<"single" | "double" | "backtick" | "mixed">;
    readonly line_ending: DetectionResult<"lf" | "crlf" | "mixed">;
  };
  readonly generated_files: readonly string[];
  readonly vendored_files: readonly string[];
  readonly file_count: number;
  readonly attribution: { readonly external_llm_used: false; readonly deterministic: true; readonly taught_by: "master_ai_engineer" };
}

// ─── Operation taxonomy (CI-5) ─────────────────────────────────────

export type OperationKind =
  | "FORMAT"
  | "STYLE_CHANGE"
  | "LINT_FIX"
  | "SYNTAX_REPAIR"
  | "DIALECT_CHANGE"
  | "LANGUAGE_TRANSLATION"
  | "FRAMEWORK_MIGRATION"
  | "DEPENDENCY_MIGRATION"
  | "FILE_FORMAT_CONVERSION"
  | "PROJECT_MIGRATION"
  | "REFACTOR"
  | "BUG_FIX"
  | "FEATURE_CHANGE"
  | "TEST_CHANGE"
  | "CONFIGURATION_CHANGE";

export interface OperationRequirements {
  readonly parser_required: boolean;
  readonly semantic_analysis_required: boolean;
  readonly validation_required: boolean;
  readonly test_required: boolean;
  readonly rollback_required: boolean;
  readonly authorisation_required: boolean;
  readonly notes: string;
}

// ─── Engineering Work Order (CI-7) ─────────────────────────────────

export interface EngineeringWorkOrder {
  readonly work_order_id: string;
  readonly created_at: string;
  readonly originating_request: string;
  readonly interpreted_intent: string;
  readonly task: OperationKind;
  readonly source: {
    readonly language: string | null;
    readonly scope: "single_file" | "multi_file" | "project";
    readonly files: readonly string[];
  };
  readonly target: {
    readonly language: string | null;
    readonly dialect: string | null;
  } | null;
  readonly constraints: {
    readonly preserve_semantics: boolean;
    readonly preserve_project_style: boolean;
    readonly generated_files_excluded: boolean;
    readonly vendored_files_excluded: boolean;
    readonly extra: readonly string[];
  };
  readonly validation: {
    readonly parse_target_required: boolean;
    readonly type_check_required: boolean;
    readonly tests_required_if_available: boolean;
    readonly diff_required: boolean;
  };
  readonly authorisation: {
    readonly mutation_required: boolean;
    readonly authorised: false;                  // v0 · Work Order is DRAFT until founder authorisation
    readonly authorisation_scope: string;
  };
  readonly capability_status: {
    readonly source_lang_capable: boolean;
    readonly target_lang_capable: boolean;
    readonly transformation_supported: boolean;
    readonly limitations: readonly string[];
  };
  readonly attribution: {
    readonly external_llm_used: false;
    readonly independent_authorship_percent: 0;
    readonly deterministic: true;
    readonly taught_by: "master_ai_engineer";
    readonly work_order_version: "v0.1.0";
  };
}
