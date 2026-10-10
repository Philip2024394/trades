// §36-S-1 · WAVE-S1 · 2026-09-14 · engineering-evidence-collector
//
// Types + refusal codes + locked constants for the engineering-evidence-collector primitive.
// See docs/NEX1/SECTION_36_S_1_ENGINEERING_EVIDENCE_COLLECTOR_AMENDMENT.md.
//
// Boundary (verbatim · unamendable):
//   "Wave S1 enables NEX1 to collect and structure static engineering-evidence
//    artefacts already present in the workspace into one deterministic, signed
//    record. It does not permit NEX1 to run tests, judge capability health,
//    cluster failures, recommend improvements, modify any file, read historical
//    signed records under data/nex-storage/, invoke primitives, or expand its
//    authoring vocabulary."

// ── Locked evidence-kind grammar (7 · exhaustive · plan v1.1 §12.1) ────

export type EvidenceKind =
  | "capability_inventory"
  | "test_run_summary"
  | "rollback_proof_inventory"
  | "grep_marker_inventory"
  | "governance_amendment_inventory"
  | "baseline_sha_verification"
  | "gap_notes";

export const APPROVED_EVIDENCE_KINDS: readonly EvidenceKind[] = Object.freeze([
  "capability_inventory",
  "test_run_summary",
  "rollback_proof_inventory",
  "grep_marker_inventory",
  "governance_amendment_inventory",
  "baseline_sha_verification",
  "gap_notes",
]);

// ── Locked path scan scope shape ────────────────────────────────────────

export interface PathScanScope {
  readonly source_roots: readonly string[];
  readonly doc_roots: readonly string[];
  readonly rollback_proof_roots: readonly string[];
}

// ── Request shape ──────────────────────────────────────────────────────

export interface EvidenceCollectionRequest {
  readonly workspace_root: string;
  readonly evidence_kinds: readonly EvidenceKind[];
  readonly wave_filter?: readonly string[];
  readonly path_scan_scope: PathScanScope;
  readonly freshness_threshold_hours?: number;
  /** Optional injected clock for deterministic testing. Default: new Date(). */
  readonly clock?: () => Date;
}

// ── Output records ─────────────────────────────────────────────────────

export interface CapabilityRecord {
  readonly wave_slug: string;
  readonly promotion_status: "promoted" | "lab_only" | "infrastructure_only" | "plan_only";
  readonly promoted_paths: readonly string[];
  readonly acceptance_report_path: string | null;
  readonly acceptance_report_sha256: string | null;
}

export interface TestRunSummaryEntry {
  readonly source: "acceptance_report";
  readonly wave_slug: string;
  readonly test_count_declared: number;
  readonly test_count_declared_source_span: string;
  readonly note: "declared_by_report_not_re_executed";
}

export interface RollbackProofEntry {
  readonly wave_slug: string;
  readonly baseline_hashes_path: string;
  readonly baseline_hashes_sha256: string;
  readonly protected_paths_declared: readonly string[];
}

export interface GrepMarkerEntry {
  readonly marker: string;
  readonly paths: readonly string[];
}

export interface GovernanceAmendmentEntry {
  readonly marker: string;
  readonly amendment_path: string;
  readonly cessation_state: "ceased" | "active" | "unknown";
}

export interface BaselineVerificationEntry {
  readonly protected_path: string;
  readonly baseline_sha256_declared: string;
  readonly current_sha256_observed: string;
  readonly match: boolean;
  readonly source_of_baseline: string;
}

export type EvidenceGapNoteKind =
  | "acceptance_report_referenced_but_missing"
  | "baseline_hash_file_missing"
  | "grep_marker_missing_in_expected_path"
  | "governance_amendment_state_unknown"
  | "test_count_source_span_not_locatable"
  | "wave_filter_slug_not_matched"
  | "capability_promotion_status_ambiguous";

export interface EvidenceGapNote {
  readonly kind: EvidenceGapNoteKind;
  readonly wave_slug: string | null;
  readonly evidence_kind: EvidenceKind | null;
  readonly path_ref: string | null;
  readonly description: string;
}

export interface EvidenceCollectionSuccess {
  readonly ok: true;
  readonly collected_at: string;
  readonly workspace_root_sha256: string;
  readonly evidence_kinds_collected: readonly EvidenceKind[];
  readonly capability_inventory: readonly CapabilityRecord[];
  readonly test_run_summary: readonly TestRunSummaryEntry[];
  readonly rollback_proof_inventory: readonly RollbackProofEntry[];
  readonly grep_marker_inventory: readonly GrepMarkerEntry[];
  readonly governance_amendment_inventory: readonly GovernanceAmendmentEntry[];
  readonly baseline_sha_verification: readonly BaselineVerificationEntry[];
  readonly gap_notes: readonly EvidenceGapNote[];
  readonly evidence_sha256: string;
}

// ── Refusal codes (exhaustive · 9 · plan v1.1 §10) ─────────────────────

export type EvidenceCollectionRefusalCode =
  | "EEC_INVALID_REQUEST"
  | "EEC_INVALID_WORKSPACE"
  | "EEC_UNKNOWN_EVIDENCE_KIND"
  | "EEC_INVALID_PATH"
  | "EEC_EVIDENCE_MISSING"
  | "EEC_EVIDENCE_STALE"
  | "EEC_BASELINE_MISMATCH"
  | "EEC_OUTPUT_TOO_LARGE"
  | "EEC_PROHIBITED_STRING_CONTENT";

export interface EvidenceCollectionFailure {
  readonly ok: false;
  readonly refusal_code: EvidenceCollectionRefusalCode;
  readonly reason: string;
  readonly offending_source?: string;
}

export type EvidenceCollectionResult = EvidenceCollectionSuccess | EvidenceCollectionFailure;

// ── Locked bounds (plan v1.1 §11.1 · §11.2 · §12.1) ────────────────────

export const EEC_MAX_OUTPUT_BYTES = 256 * 1024;
export const EEC_MAX_SCAN_DEPTH = 6;
export const EEC_MAX_FILES_PER_ROOT = 4096;
export const EEC_MAX_EVIDENCE_KINDS = 7;
export const EEC_MAX_WAVE_FILTER_ENTRIES = 64;
export const EEC_MAX_SCOPE_ARRAY = 32;
export const EEC_MAX_FRESHNESS_HOURS = 8760;
export const EEC_DEFAULT_FRESHNESS_HOURS = 720;

/** Locked approved extensions (plan v1.1 §12.1). Any other extension in a
 *  scope-configured path → EEC_INVALID_PATH. */
export const EEC_APPROVED_EXTENSIONS: readonly string[] = Object.freeze([
  ".ts", ".tsx", ".md", ".txt", ".png",
]);

/** Directory basenames that halt recursive traversal (plan v1.1 §11.1). */
export const EEC_EXCLUDED_DIR_BASENAMES: readonly string[] = Object.freeze([
  "node_modules", ".git", ".next", "dist", "build", "secrets",
]);

/** Path prefixes that are explicitly excluded (plan v1.1 §12.3). Any
 *  scope-configured path resolving inside one → EEC_INVALID_PATH. */
export const EEC_EXCLUDED_PATH_PREFIXES: readonly string[] = Object.freeze([
  "data/nex-storage",
  "data/nex-agent-workspaces",
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
]);

/** Basename prefixes that are secret/sensitive · always refused (plan v1.1 §12.3). */
export const EEC_EXCLUDED_BASENAME_PREFIXES: readonly string[] = Object.freeze([
  ".env",
  "credentials",
  "secrets",
]);

/** Prohibited substrings scanned in strings that come from the request.
 *  Matches Route 2 defensive posture. */
export const EEC_PROHIBITED_SUBSTRINGS: readonly string[] = Object.freeze([
  "\0",
  "eval(",
  "Function(",
  "new Function",
  "child_process",
  "__proto__",
  "constructor.prototype",
  "<script",
  "</script",
]);

// ── Locked pattern registry (plan v1.1 §11.2 · exhaustive · 6 patterns) ─
//
// Any new extraction pattern requires AMEND WAVE S1 PLAN.

export const TEST_COUNT_SPAN_RE = /(\d+)\/(\d+)\s+(?:tests?|R\d+\s+tests?)\s+pass/i;
export const SHA256_BASELINE_LINE_RE = /^([0-9a-f]{64})\s+\*?(.+?)$/;
export const WAVE_GREP_MARKER_RE = /§36-[A-Z\-]+ · [A-Z0-9\-]+ · \d{4}-\d{2}-\d{2}(?: · [A-Za-z0-9\-]+)?/;
export const PLAN_ONLY_WAVE_GREP_MARKER_RE = /WAVE-[A-Z0-9]+ · PLAN-ONLY · \d{4}-\d{2}-\d{2}/;
export const PLAN_ONLY_IESB_GREP_MARKER_RE = /IESB · PLAN-ONLY · \d{4}-\d{2}-\d{2}/;
export const VERDICT_PASS_RE = /(?:\*\*Verdict:\*\* PASS\b|\*\*PASS verdict\*\*|verdict PASS\b|VERDICT:\s+PASS\b)/;
export const AMENDMENT_STATE_ACTIVE_RE = /^CESSATION_STATE: active$/m;

// ── Authoritative acceptance-report registry (plan v1.1 §12.2) ─────────
//
// A capability_inventory record's acceptance_report_path MUST resolve to
// exactly one of these locked patterns. Anything else emits a gap note.

export interface AcceptanceReportRegistryEntry {
  readonly wave_slug: string;
  readonly authoritative_path: string;
}

export const ACCEPTANCE_REPORT_REGISTRY: readonly AcceptanceReportRegistryEntry[] = Object.freeze([
  { wave_slug: "route-2", authoritative_path: "data/route-2-rollback-proof/ROUTE-2-ACCEPTANCE-REPORT.md" },
  { wave_slug: "route-2b", authoritative_path: "data/route-2b-rollback-proof/ROUTE-2B-ACCEPTANCE-REPORT.md" },
  { wave_slug: "route-2c", authoritative_path: "data/route-2c-rollback-proof/ROUTE-2C-ACCEPTANCE-REPORT.md" },
  { wave_slug: "c1", authoritative_path: "data/capability-labs/c1-nex-facial-state-model/C1-STEP-5-ACCEPTANCE-REPORT.md" },
  { wave_slug: "r1a", authoritative_path: "data/route-r1a-rollback-proof/WAVE-R1A-ACCEPTANCE-REPORT.md" },
  { wave_slug: "r1b", authoritative_path: "data/route-r1b-rollback-proof/WAVE-R1B-ACCEPTANCE-REPORT.md" },
  { wave_slug: "r2", authoritative_path: "docs/NEX1/BUILD_GATES/WAVE-R2-ACCEPTANCE-REPORT.md" },
]);
