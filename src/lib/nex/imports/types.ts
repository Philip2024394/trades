// NEX Data Import Wizard · shared types
//
// The Import Runtime is the single pipeline every structured data import
// flows through — CSV, TSV (today), Excel/JSON (planned), and every
// future connector that ingests tabular data. No import should bypass
// this pipeline; the CSV/TSV connectors are façades over it.
//
// Doctrine: constitution_nex_data_import_wizard_2026_08_07.md

export type FileFormat = "csv" | "tsv" | "xlsx" | "json" | "unknown";

/** Canonical registry target fields the wizard knows how to map to. */
export const CANONICAL_FIELDS = [
  "email",
  "phone",
  "name",
  "company",
  "country",
  "region",
  "lifecycle_stage",
  "tags",
  "trade_categories",
] as const;
export type CanonicalField = typeof CANONICAL_FIELDS[number];

/** Every column in a source file resolves to one of these targets. */
export type MappingTarget = CanonicalField | "attribute" | "ignore";

/** Full column mapping: source_column → target directive. */
export type ColumnMapping = Record<string, MappingTarget>;

// ── Validation ────────────────────────────────────────────────────

export type ValidationCode =
  | "invalid_email"
  | "invalid_phone"
  | "missing_required"                // no email AND no phone
  | "empty_row"
  | "in_file_duplicate"
  | "unknown_column";

export type ValidationIssue = {
  row_index: number;                  // 1 = first data row (header excluded)
  field: string | null;
  code: ValidationCode;
  detail: string;
};

// ── Predictions ───────────────────────────────────────────────────

export type DuplicatePrediction = {
  row_index: number;
  email: string | null;
  phone: string | null;
  existing_contact_id: string;
  match_kind: "email_exact" | "phone_exact";
};

export type ComplianceWarningCode =
  | "would_grant_marketing_after_revoke"      // existing = false, incoming = true (ratchet will preserve false)
  | "would_clear_unsubscribe"                  // existing has unsubscribe_at, incoming would overwrite (ratchet preserves original)
  | "would_clear_never_contact";                // existing never_contact = true, incoming = false (ratchet preserves true)

export type ComplianceWarning = {
  row_index: number;
  code: ComplianceWarningCode;
  existing_state: unknown;
  incoming_state: unknown;
  ratchet_will_preserve_safer_state: true;    // always true — the ratchet always wins; this is informational for the admin
};

// ── Dry-run summary ───────────────────────────────────────────────

export type DryRunSummary = {
  records_processed: number;
  would_create: number;
  would_update: number;
  duplicate_predictions: DuplicatePrediction[];
  invalid_rows: ValidationIssue[];
  in_file_duplicates: number;
  empty_rows: number;
  compliance_warnings: ComplianceWarning[];
  unknown_columns: string[];                   // columns that map to "attribute" or have no auto-mapping
  estimated_duration_ms: number;
  preview_rows: Record<string, string>[];      // first 5 mapped rows
};

// ── Final import report ───────────────────────────────────────────

export type ImportReport = {
  import_id: string;                           // session_id at commit time
  started_at: string;
  finished_at: string;
  duration_ms: number;
  file_name: string | null;
  format: FileFormat;
  admin_actor: string | null;
  records_processed: number;
  created: number;
  updated: number;
  skipped_no_identifier: number;
  errors: number;
  error_samples: string[];
  duplicate_suggestions_written: number;       // Phase 3c will surface these from dedup
  mapping_used: ColumnMapping;
  mapping_profile_id: string | null;
};

// ── Session (in-memory · phase 3b.6b) ─────────────────────────────

export type ImportSessionState =
  | "uploaded"                  // parsed file, auto-mapping applied
  | "mapped"                    // admin overrode mapping
  | "dry_ran"                   // dry-run summary available
  | "committing"                // in progress
  | "committed"                 // done · has final report
  | "failed";                   // catastrophic failure (bad format · parse error · commit error)

export type ImportSession = {
  session_id: string;
  admin_actor: string | null;
  created_at: string;
  updated_at: string;
  file_name: string | null;
  format: FileFormat;
  header: string[];
  header_signature: string;               // hash of normalized header · used by mapping-profile suggestions
  row_count: number;                       // data rows (header excluded)
  mapping: ColumnMapping;
  mapping_source: "auto" | "manual" | { profile_id: string };
  state: ImportSessionState;
  dry_run: DryRunSummary | null;
  final_report: ImportReport | null;
  error: string | null;
  // Not exposed in API responses · internal only:
  _raw_rows?: string[][];                  // parsed rows (header at index 0)
};

// ── Mapping profile (persisted in nex.import_mappings) ────────────

export type MappingProfile = {
  profile_id: string;
  label: string;
  description: string | null;
  header_signature: string;
  mapping: ColumnMapping;
  format_hint: FileFormat | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  used_count: number;
  last_used_at: string | null;
};

export type MappingProfileInput = {
  label: string;
  description?: string | null;
  header_signature: string;
  mapping: ColumnMapping;
  format_hint?: FileFormat | null;
  created_by?: string | null;
};
