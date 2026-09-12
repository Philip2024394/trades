// WO-WORKSTATION-03 · code generation types
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Deterministic authoring pipeline — no LLM inside NEX (P-S), no direct
// filesystem writes (that is WO-04 Controlled Hands), no bypass of
// Security 3, no fake success paths.

/**
 * ProjectModel · structured representation of what to build.
 * Descriptive only — templates + generator translate this into file
 * operations. This is what a Founder request (raw_request) becomes
 * after deterministic parsing + requirements extraction (WO-01 upstream).
 */
export interface ProjectModel {
  readonly record_type: "NEX1_PROJECT_MODEL";
  readonly project_id: string;
  readonly trace_id: string;
  readonly project_name: string;
  readonly framework: "next-app-router" | "static-html";  // extendable
  readonly pages: readonly PageSpec[];
  readonly created_at: string;
  readonly deterministic_extractor_version: string;
}

export interface PageSpec {
  readonly route: string;         // e.g. "/", "/about", "/contact"
  readonly title: string;
  readonly headline: string;
  readonly body: readonly string[]; // paragraph strings
}

// ── File Plan ───────────────────────────────────────────────────────────

export type FileOpKind = "create" | "modify" | "delete";

export interface FileOp {
  readonly kind: FileOpKind;
  /** Path relative to the project workspace root. Never absolute.
   *  Never contains `..` segments. Enforced by the Challenger. */
  readonly path: string;
  readonly template_ref?: string;          // required for create/modify
  readonly template_params?: Readonly<Record<string, unknown>>;
  readonly reason: string;                 // human-readable why
}

export interface FilePlan {
  readonly record_type: "NEX1_FILE_PLAN";
  readonly plan_id: string;
  readonly project_id: string;
  readonly trace_id: string;
  readonly ops: readonly FileOp[];
  readonly created_at: string;
}

// ── Candidate Files (post-generation, pre-write) ────────────────────────

export interface CandidateFile {
  readonly path: string;
  readonly content: string;
  readonly content_hash: string;           // sha256 hex
  readonly source_template: string;
  readonly bytes: number;
}

// ── Syntax Validation Result ────────────────────────────────────────────

export type SyntaxValidationResult =
  | { ok: true }
  | { ok: false; reason: string; reason_code: SyntaxValidationCode; path: string };

export type SyntaxValidationCode =
  | "JSON_PARSE_FAILED"
  | "UNBALANCED_BRACKETS"
  | "UNBALANCED_QUOTES"
  | "UNKNOWN_EXTENSION"
  | "EMPTY_CONTENT";

// ── Diff (comparison to current filesystem state) ───────────────────────

export type DiffOpKind = "add" | "modify" | "delete" | "unchanged";

export interface DiffEntry {
  readonly path: string;
  readonly kind: DiffOpKind;
  readonly current_hash: string | null;
  readonly next_hash: string | null;
  readonly current_bytes: number | null;
  readonly next_bytes: number | null;
}

export interface Diff {
  readonly record_type: "NEX1_DIFF";
  readonly diff_id: string;
  readonly plan_id: string;
  readonly project_id: string;
  readonly trace_id: string;
  readonly workspace_root: string;         // absolute, resolved
  readonly entries: readonly DiffEntry[];
  readonly created_at: string;
  readonly digest: string;                 // sha256 hex over canonical serialisation of entries — used to bind to auth
}

// ── Challenger Result ───────────────────────────────────────────────────

export type ChallengeCode =
  | "PATH_ABSOLUTE"
  | "PATH_ESCAPES_WORKSPACE"
  | "PATH_TOUCHES_PROTECTED_ROOT"
  | "PATH_EMPTY"
  | "TEMPLATE_UNKNOWN"
  | "TEMPLATE_MISSING_FOR_CREATE"
  | "CONTENT_EMPTY"
  | "DANGEROUS_PATTERN_EVAL"
  | "DANGEROUS_PATTERN_FUNCTION_CTOR"
  | "DANGEROUS_PATTERN_CHILD_PROCESS"
  | "DUPLICATE_PATH_IN_PLAN";

export interface ChallengeFinding {
  readonly code: ChallengeCode;
  readonly path: string;
  readonly detail: string;
}

export type ChallengeResult =
  | { ok: true }
  | { ok: false; findings: readonly ChallengeFinding[] };

// ── Authorised Diff Bundle (handoff to WO-04) ───────────────────────────

/**
 * Produced ONLY when a valid FounderAuthorization admits the requested
 * action (wo3.apply_diff) AND the diff has passed the challenger.
 * WO-04 (Controlled Hands) will accept only bundles whose diff_digest
 * matches the diff and whose authorization signature verifies.
 *
 * The bundle itself is NOT re-signed here — it inherits authority from
 * the enclosed authorization + the diff_digest binding. WO-04 can
 * recompute the digest and re-verify.
 */
export interface AuthorisedDiffBundle {
  readonly record_type: "NEX1_AUTHORISED_DIFF_BUNDLE";
  readonly bundle_id: string;
  readonly project_id: string;
  readonly trace_id: string;
  readonly diff: Diff;
  readonly candidate_files: readonly CandidateFile[];
  readonly authorization_id: string;       // WO-02 authorization_id
  readonly founder_key_id: string;         // for audit
  readonly authorised_action: "wo3.apply_diff";
  readonly created_at: string;
}

// ── Pipeline result (top-level) ─────────────────────────────────────────

export type PipelineFailureCode =
  | "PLAN_INVALID"
  | "TEMPLATE_MISSING"
  | "GENERATION_FAILED"
  | "SYNTAX_INVALID"
  | "CHALLENGE_FAILED"
  | "AUTHORIZATION_INVALID"
  | "AUTHORIZATION_MISSING_ACTION"
  | "WORKSPACE_ROOT_UNSAFE";

export type PipelineResult =
  | { ok: true; bundle: AuthorisedDiffBundle }
  | { ok: false; reason_code: PipelineFailureCode; reason: string; findings?: readonly ChallengeFinding[]; failed_path?: string };
