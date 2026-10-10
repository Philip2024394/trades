// §36-D-A · ROUTE-R1A · 2026-09-14 · repo-scan
//
// Type definitions and refusal codes for the read-only repo-scan primitive.
// See docs/NEX1/SECTION_36_D_A_ROUTE_R1A_REPO_SCAN_AMENDMENT.md.
//
// Boundary declaration (verbatim from §36-D-A · unamendable):
//   "Route R1a enables NEX1 to look at NEX safely; it does not permit NEX1
//    to change NEX, invoke primitives, or expand its authoring vocabulary."
//
// The primitive is read-only · deterministic · never emits file content.

// ── Request shape ──────────────────────────────────────────────────────

/** Inputs to a repo-scan invocation. Every field is required. Every field
 *  is validated against the locked grammar before any file is read. */
export interface RepoScanRequest {
  /** Workspace-relative roots to scan. Must be from the approved list. */
  readonly read_roots: readonly string[];
  /** File extensions to include. Must be a subset of the approved list
   *  (.ts, .tsx, .mts, .md). No other extensions are readable. */
  readonly extensions: readonly string[];
  /** Hard cap on total files scanned. Must be a positive integer in [1, 4000].
   *  Scans that would exceed this cap are refused deterministically. */
  readonly max_files: number;
  /** If true, extract top-level symbol declarations (functions · classes ·
   *  interfaces · type aliases · consts · enums · variables). */
  readonly include_symbols: boolean;
  /** If true, extract import statements (type-only and runtime, symbols
   *  and specifiers). */
  readonly include_imports: boolean;
}

// ── Response · success shape ───────────────────────────────────────────

export interface RepoFileMetadata {
  /** Workspace-relative path · forward-slash normalised. */
  readonly path: string;
  /** File extension including the leading dot · e.g. ".ts". */
  readonly extension: string;
  /** File size in bytes. */
  readonly bytes: number;
  /** SHA-256 hex of the file content. Content itself is NEVER emitted. */
  readonly sha256_hex: string;
}

export interface RepoSymbolEntry {
  /** Workspace-relative file containing the symbol. */
  readonly file: string;
  /** Symbol name. Always a valid identifier. */
  readonly name: string;
  /** What kind of declaration this symbol is. */
  readonly kind: "function" | "class" | "interface" | "type_alias" | "const" | "enum" | "variable";
  /** Whether the declaration is exported (has `export` keyword). */
  readonly exported: boolean;
  /** 1-indexed source line where the declaration begins. */
  readonly line: number;
}

export interface RepoImportEntry {
  /** Workspace-relative file containing the import statement. */
  readonly from_file: string;
  /** Imported symbols (in the order they appear in the import list). */
  readonly symbols: readonly string[];
  /** The specifier exactly as written · not resolved · e.g. "./x" or "next/server". */
  readonly from_specifier: string;
  /** True if the import statement is `import type { ... }`. */
  readonly is_type_only: boolean;
}

/** The complete Repository Map. Deterministic: same request → identical bytes. */
export interface RepositoryMap {
  readonly root_paths: readonly string[];
  readonly file_count: number;
  readonly files: readonly RepoFileMetadata[];
  readonly symbols: readonly RepoSymbolEntry[];
  readonly imports: readonly RepoImportEntry[];
  /** Deterministic SHA-256 of the map serialised (excluding this field itself). */
  readonly scan_sha256: string;
}

// ── Refusal codes (exhaustive · structured) ────────────────────────────

export type RepoScanRefusalCode =
  | "REPO_SCAN_ROOT_NOT_APPROVED"        // read_roots contains a path outside the approved list
  | "REPO_SCAN_EXTENSION_NOT_APPROVED"    // extensions contains something outside .ts/.tsx/.mts/.md
  | "REPO_SCAN_TOO_MANY_FILES"           // scan would exceed max_files cap
  | "REPO_SCAN_OUTPUT_TOO_LARGE"         // serialised RepositoryMap > 512 KB
  | "REPO_SCAN_INVALID_PATH"             // path traversal / null byte / backslash / absolute
  | "REPO_SCAN_PROHIBITED_FILE_PATTERN"  // filename matches .env* / credentials* / secret*
  | "REPO_SCAN_INVALID_IDENTIFIER"       // an extracted name is not a valid identifier
  | "REPO_SCAN_INVALID_MAX_FILES"        // max_files not a positive integer within [1, 4000]
  | "REPO_SCAN_EMPTY_REQUEST"            // read_roots or extensions is empty
  | "REPO_SCAN_INVALID_REQUEST"          // request shape is malformed
  | "REPO_SCAN_CONTENT_LEAK";            // sentinel · structural invariant broken (should be impossible)

export interface RepoScanFailure {
  readonly ok: false;
  readonly refusal_code: RepoScanRefusalCode;
  readonly reason: string;
  readonly offending_path?: string;
}

export interface RepoScanSuccess {
  readonly ok: true;
  readonly map: RepositoryMap;
}

export type RepoScanResult = RepoScanSuccess | RepoScanFailure;

// ── Approved constants (locked) ────────────────────────────────────────

/** Approved read roots · workspace-relative · forward-slash normalised.
 *  Any read_root outside this list is refused with REPO_SCAN_ROOT_NOT_APPROVED. */
export const APPROVED_READ_ROOTS: readonly string[] = Object.freeze([
  "src/lib/nex-agent-runtime/",
  "src/lib/capability-labs/",
  "src/app/api/nex/",
  "docs/NEX1/BUILD_GATES/",
  "docs/NEX1/",
]);

/** Approved file extensions (including the leading dot).
 *  Any extension outside this list is refused with REPO_SCAN_EXTENSION_NOT_APPROVED. */
export const APPROVED_EXTENSIONS: readonly string[] = Object.freeze([
  ".ts", ".tsx", ".mts", ".md",
]);

/** Filename patterns whose presence in a path prohibits reading. */
export const PROHIBITED_FILENAME_SUBSTRINGS: readonly string[] = Object.freeze([
  ".env",
  "credentials",
  "secret",
  ".git/",
  "node_modules/",
]);

/** Hard caps · locked. */
export const REPO_SCAN_MAX_FILES_LIMIT = 4000;
export const REPO_SCAN_MAX_OUTPUT_BYTES = 512 * 1024;
