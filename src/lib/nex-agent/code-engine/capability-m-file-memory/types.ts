// src/lib/nex-agent/code-engine/capability-m-file-memory/types.ts
//
// NEX1 · CAPABILITY M-1 · FILE MEMORY INDEX · type surface.
// Deterministic · zero LLM · append-only JSONL + in-memory index.
//
// Purpose:
//   Give NEX1 a persistent, inspectable record of every source file she has
//   seen. She can rememberFile(path), recallFile(path), listFiles(filter),
//   and forgetFile(path). Content-hash + language + tags + summary preserved.
//
// Storage contract:
//   - Append-only JSONL at a configured path (default: data/nex-code-brain/
//     file-memory/index.jsonl under repo root).
//   - Records are one of: RememberRecord | ForgetRecord.
//   - Latest-write-wins semantics per path on replay.
//   - No history compaction (retention policy is a follow-up).

/** One remembered file's current-state snapshot. */
export interface Nex1FileMemoryEntry {
  readonly path: string; // repo-relative, forward-slash normalised
  readonly sha256: string; // full hex, lower-case
  readonly size_bytes: number;
  readonly language: string; // extension-derived, e.g. "typescript" / "python" / "unknown"
  readonly first_seen_iso: string;
  readonly last_seen_iso: string;
  readonly tags: readonly string[];
  readonly summary: string | null;
  readonly taught_by: "master_ai_engineer";
}

/** Persistence record: append this to the JSONL when a file is remembered. */
export interface RememberRecord {
  readonly kind: "remember";
  readonly entry: Nex1FileMemoryEntry;
  readonly recorded_at_iso: string;
}

/** Persistence record: append this to the JSONL when a file is forgotten. */
export interface ForgetRecord {
  readonly kind: "forget";
  readonly path: string;
  readonly reason: string;
  readonly recorded_at_iso: string;
}

export type PersistenceRecord = RememberRecord | ForgetRecord;

/** Input to rememberFile(). */
export interface RememberFileInput {
  readonly path: string; // repo-relative or absolute-inside-repo
  readonly tags?: readonly string[];
  readonly summary?: string;
}

export type RememberRefusalCode =
  | "path_empty"
  | "path_outside_repo"
  | "path_traversal_attempt"
  | "file_not_found"
  | "file_too_large"
  | "summary_too_long"
  | "tags_too_many"
  | "storage_write_failed";

export interface RememberOk {
  readonly ok: true;
  readonly entry: Nex1FileMemoryEntry;
  readonly was_already_remembered: boolean;
  readonly content_changed: boolean;
}

export interface RememberRefused {
  readonly ok: false;
  readonly refusal: RememberRefusalCode;
  readonly reason: string;
}

export type RememberResult = RememberOk | RememberRefused;

/** Result of recallFile(). */
export type RecallResult =
  | { readonly kind: "found"; readonly entry: Nex1FileMemoryEntry }
  | { readonly kind: "not_remembered"; readonly path: string }
  | { readonly kind: "forgotten"; readonly path: string; readonly forgotten_at_iso: string; readonly reason: string };

/** Filter for listFiles(). */
export interface ListFilesFilter {
  readonly path_prefix?: string;
  readonly language?: string;
  readonly tag?: string;
  readonly limit?: number;
}

/** Result of listFiles(). Ordered by last_seen_iso desc. */
export interface ListFilesResult {
  readonly total_matching: number;
  readonly returned: number;
  readonly entries: readonly Nex1FileMemoryEntry[];
}

/** Public store handle. */
export interface FileMemoryStore {
  rememberFile(input: RememberFileInput): RememberResult;
  recallFile(path: string): RecallResult;
  listFiles(filter?: ListFilesFilter): ListFilesResult;
  forgetFile(path: string, reason: string): { ok: boolean; reason?: string };
  /** Size of the in-memory index (remembered entries, excluding forgotten). */
  size(): number;
  /** For tests + observability: the absolute storage path being used. */
  storagePathAbs(): string;
  /** Force-reload from disk. Deterministic; useful for tests. */
  reload(): void;
}

export interface CreateFileMemoryStoreInput {
  readonly repo_root: string;
  /** Absolute or repo-relative. Defaults to data/nex-code-brain/file-memory/index.jsonl. */
  readonly storage_path?: string;
}

// Constants — deliberate limits keep the store bounded and inspectable.
export const NEX1_FM_MAX_FILE_BYTES = 32 * 1024 * 1024; // 32 MB
export const NEX1_FM_MAX_SUMMARY_CHARS = 2000;
export const NEX1_FM_MAX_TAGS = 32;
export const NEX1_FM_MAX_LIST_LIMIT = 5000;
export const NEX1_FM_DEFAULT_LIST_LIMIT = 100;
