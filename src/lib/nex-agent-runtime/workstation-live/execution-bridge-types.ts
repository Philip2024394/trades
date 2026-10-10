// §36-E-1 · WAVE-E1 · 2026-09-14 · execution-bridge
// NEX bounded infrastructure · execution-bridge types · 2026-09-14
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Types + refusal codes + locked constants for the execution-bridge primitive.
//
// Boundary (verbatim · unamendable):
//   "Wave E1 enables NEX1 to convert an execution-authorised mission work-order
//    plus a typed_data_contract spec plus a caller-supplied authorised_file_set
//    into a deterministic byte-emission proposal with SHA pre-verification,
//    per-file provenance, and refusal-first path safety. It does not permit
//    NEX1 to write files, execute shells, invoke networks, expand authoring
//    vocabulary beyond typed_data_contract, or grant itself authority beyond
//    the caller-supplied authorised_file_set."

import type { TypedDataContractSpec, StyleProfile } from "../programming-mission/types";

// ── Request ────────────────────────────────────────────────────────────

export interface AuthorisedTarget {
  readonly workspace_relative_path: string;   // e.g. "src/lib/foo/types.ts"
  readonly expected_change_kind: "file_new" | "file_content";
  readonly current_sha256_hex: string | null;  // null iff expected_change_kind === "file_new"
}

export interface ExecutionBridgeRequest {
  readonly mission_id: string;
  readonly workspace_root: string;             // absolute path · used only for logging · never used for I/O
  readonly authorised_file_set: readonly AuthorisedTarget[];
  readonly spec: TypedDataContractSpec;         // consumed via typed_data_contract primitive
  readonly target_path: string;                 // which file this spec authors · MUST appear in authorised_file_set
  readonly style: StyleProfile;
  readonly clock?: () => Date;
}

// ── Output records ─────────────────────────────────────────────────────

export interface EmittedFile {
  readonly workspace_relative_path: string;
  readonly kind: "file_new" | "file_content";
  readonly proposed_bytes_sha256: string;
  readonly proposed_bytes_length: number;
  readonly current_sha256_declared: string | null;
  readonly typed_data_contract_source: "authorTypedDataContract";
}

export interface ExecutionBridgeSuccess {
  readonly ok: true;
  readonly mission_id: string;
  readonly assessed_at: string;
  readonly emitted_files: readonly EmittedFile[];
  /** The proposed content string · returned so the caller can write via
   *  the existing WO-04 broker-write path or discard on refusal. */
  readonly proposed_content: string;
  readonly evidence_sha256: string;
}

// ── Refusal codes (exhaustive · 7) ─────────────────────────────────────

export type ExecutionBridgeRefusalCode =
  | "WE_INVALID_REQUEST"
  | "WE_UNAUTHORISED_TARGET"        // target_path not in authorised_file_set
  | "WE_INVALID_AUTHORISED_TARGET"  // a target in the set has malformed path or sha
  | "WE_CURRENT_SHA_MISMATCH"       // authorised target's declared current SHA does not match a caller-supplied fresh probe (future extension)
  | "WE_TYPED_DATA_CONTRACT_REFUSED"
  | "WE_INVALID_SPEC"
  | "WE_OUTPUT_TOO_LARGE";

export interface ExecutionBridgeFailure {
  readonly ok: false;
  readonly refusal_code: ExecutionBridgeRefusalCode;
  readonly reason: string;
  readonly offending_field?: string;
  /** When refusal_code === "WE_TYPED_DATA_CONTRACT_REFUSED", propagate the
   *  underlying refusal code verbatim (never repackaged). */
  readonly propagated_refusal_code?: string;
  readonly propagated_reason?: string;
}

export type ExecutionBridgeResult = ExecutionBridgeSuccess | ExecutionBridgeFailure;

// ── Locked bounds ──────────────────────────────────────────────────────

export const WE_MAX_OUTPUT_BYTES = 128 * 1024;
export const WE_MAX_AUTHORISED_TARGETS = 32;
export const WE_MAX_PATH_LENGTH = 512;

export const WE_PROHIBITED_PATH_SUBSTRINGS: readonly string[] = Object.freeze([
  "\0",
  "..",
  "\\",
  "<script",
  "child_process",
  "__proto__",
]);
