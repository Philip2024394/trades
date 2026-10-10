// §36-ROUTE-2E · ROUTE-2E · 2026-09-15 · route-2e-bounded-file-edit
// NEX bounded infrastructure · Route 2e types · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Locked catalogue: 3 operations · 13 refusal codes · protected-path list ·
// bounded output size · locked prohibited-substring blacklist.

export const ROUTE_2E_GREP_MARKER = "§36-ROUTE-2E · ROUTE-2E · 2026-09-15 · route-2e-bounded-file-edit" as const;
export type Route2eGrepMarker = typeof ROUTE_2E_GREP_MARKER;

// ── Locked refusal codes (13) ───────────────────────────────────────────

export type Route2eRefusalCode =
  | "R2E_INVALID_REQUEST"
  | "R2E_INVALID_OPERATION_ARGS"
  | "R2E_PATH_OUTSIDE_WORKSPACE"
  | "R2E_PATH_PROTECTED_MODULE"
  | "R2E_PATH_DENIED_ROOT"
  | "R2E_SHA_MISMATCH"
  | "R2E_POSTCONDITION_ALREADY_SATISFIED"
  | "R2E_POSTCONDITION_UNSATISFIABLE"
  | "R2E_MULTIPLE_ANCHOR_MATCHES"
  | "R2E_NO_ANCHOR_MATCH"
  | "R2E_OUTPUT_TOO_LARGE"
  | "R2E_PROHIBITED_CONTENT"
  | "R2E_INTERNAL";

export const ROUTE_2E_REFUSAL_CODES: readonly Route2eRefusalCode[] = Object.freeze([
  "R2E_INVALID_REQUEST",
  "R2E_INVALID_OPERATION_ARGS",
  "R2E_PATH_OUTSIDE_WORKSPACE",
  "R2E_PATH_PROTECTED_MODULE",
  "R2E_PATH_DENIED_ROOT",
  "R2E_SHA_MISMATCH",
  "R2E_POSTCONDITION_ALREADY_SATISFIED",
  "R2E_POSTCONDITION_UNSATISFIABLE",
  "R2E_MULTIPLE_ANCHOR_MATCHES",
  "R2E_NO_ANCHOR_MATCH",
  "R2E_OUTPUT_TOO_LARGE",
  "R2E_PROHIBITED_CONTENT",
  "R2E_INTERNAL",
]);

// ── Locked operations (3) ───────────────────────────────────────────────

export type Route2eOperationKind =
  | "add_named_export"
  | "insert_import"
  | "replace_matched_region";

export const ROUTE_2E_OPERATION_KINDS: readonly Route2eOperationKind[] = Object.freeze([
  "add_named_export",
  "insert_import",
  "replace_matched_region",
]);

export interface AddNamedExportOp {
  readonly kind: "add_named_export";
  readonly export_name: string;
  readonly export_declaration: string;
  readonly must_not_already_exist: true;
}

export interface InsertImportOp {
  readonly kind: "insert_import";
  readonly import_line: string;
  readonly must_not_already_exist: true;
}

export interface ReplaceMatchedRegionOp {
  readonly kind: "replace_matched_region";
  readonly anchor: string;
  readonly replacement: string;
  readonly must_be_unique: true;
}

export type Route2eOperation = AddNamedExportOp | InsertImportOp | ReplaceMatchedRegionOp;

// ── Locked protected-path prefixes (Route 2e refuses any op on these) ──

export const ROUTE_2E_PROTECTED_PREFIXES: readonly string[] = Object.freeze([
  "src/lib/nex-agent-runtime/skills/",
  "src/lib/nex-agent-runtime/specialist-reviewers/",
  "src/lib/nex-agent-runtime/wave-a-language-framework/",
  "src/lib/nex-agent-runtime/wave-b-cross-cutting/",
  "src/lib/nex-agent-runtime/route-2-typed-data-contract/",
  "src/lib/nex-agent-runtime/route-2b-runtime-imports/",
  "src/lib/nex-agent-runtime/route-2c-runtime-import-literals/",
  "src/lib/nex-agent-runtime/route-2d-small-app-authoring/",
  "src/lib/nex-agent-runtime/route-2e-bounded-file-edit/",
  "src/lib/nex-agent-runtime/self-diagnostics/",
  "src/lib/nex-agent-runtime/adversarial-refutation/",
  "src/lib/nex-agent-runtime/session-lifecycle/",
  "src/lib/nex-agent-runtime/cli-mcp-surface/",
  "src/lib/nex-agent-runtime/founder-authority/",
  "src/lib/nex-agent-runtime/security/",
  "src/lib/nex-agent-runtime/c1-nex-facial-state-model/",
  "db/migrations/",
]);

// ── Locked prohibited substrings (must not appear in NEW output) ────────

export const ROUTE_2E_PROHIBITED_SUBSTRINGS: readonly string[] = Object.freeze([
  "eval(",
  "new Function(",
  "Function()(",
  "child_process",
  "<script>",
  "</script>",
  "dangerouslySetInnerHTML",
  "__proto__",
  "constructor.prototype",
]);

// ── Locked bounds ───────────────────────────────────────────────────────

export const R2E_MAX_OUTPUT_BYTES = 131_072; // 128 KB
export const R2E_MAX_STRING_ARG_LENGTH = 4_096;
export const R2E_MIN_ANCHOR_LENGTH = 8;

// ── Request / response shapes ───────────────────────────────────────────

export interface Route2eRequest {
  readonly workspace_relative_path: string;
  readonly current_content: string;
  readonly current_sha256_hex: string;
  readonly operation: Route2eOperation;
  readonly expected_postcondition_substring: string;
}

export interface Route2eSuccess {
  readonly kind: "SUCCESS";
  readonly workspace_relative_path: string;
  readonly operation_kind: Route2eOperationKind;
  readonly new_content: string;
  readonly new_sha256_hex: string;
  readonly bytes_added: number;
  readonly grep_marker: Route2eGrepMarker;
}

export interface Route2eFailure {
  readonly kind: "FAILURE";
  readonly refusal_code: Route2eRefusalCode;
  readonly reason: string;
  readonly grep_marker: Route2eGrepMarker;
}

export type Route2eResult = Route2eSuccess | Route2eFailure;
