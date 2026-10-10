// §36-W-3 · W-3 · 2026-09-15 · workstation-execution-bridge
// NEX bounded infrastructure · execution-bridge types · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.

import type { StructuredCommand } from "../command-parser/command-parser-types";

// ── Locked refusal codes ───────────────────────────────────────────────

export type ExecutionBridgeRefusalCode =
  | "WRE_INVALID_REQUEST"
  | "WRE_MISSING_AUTHORISATION"
  | "WRE_INVALID_STRUCTURED_COMMAND"
  | "WRE_UNKNOWN_TARGET_APP"
  | "WRE_UNKNOWN_ELEMENT"
  | "WRE_UNKNOWN_PROPERTY_FOR_ELEMENT"
  | "WRE_INVALID_VALUE_FOR_PROPERTY"
  | "WRE_TARGET_PATH_OUTSIDE_ROOT"
  | "WRE_PROTECTED_TARGET_PATH"
  | "WRE_SPEC_MERGE_FAILED"
  | "WRE_AUTHORING_REFUSED"
  | "WRE_FILE_WRITE_FAILED"
  | "WRE_TEST_RUN_SPAWN_FAILED"
  | "WRE_TEST_RUN_TIMEOUT"
  | "WRE_TEST_RUN_FAILED"
  | "WRE_INTERNAL";

export const EXECUTION_BRIDGE_REFUSAL_CODES: readonly ExecutionBridgeRefusalCode[] = Object.freeze([
  "WRE_INVALID_REQUEST",
  "WRE_MISSING_AUTHORISATION",
  "WRE_INVALID_STRUCTURED_COMMAND",
  "WRE_UNKNOWN_TARGET_APP",
  "WRE_UNKNOWN_ELEMENT",
  "WRE_UNKNOWN_PROPERTY_FOR_ELEMENT",
  "WRE_INVALID_VALUE_FOR_PROPERTY",
  "WRE_TARGET_PATH_OUTSIDE_ROOT",
  "WRE_PROTECTED_TARGET_PATH",
  "WRE_SPEC_MERGE_FAILED",
  "WRE_AUTHORING_REFUSED",
  "WRE_FILE_WRITE_FAILED",
  "WRE_TEST_RUN_SPAWN_FAILED",
  "WRE_TEST_RUN_TIMEOUT",
  "WRE_TEST_RUN_FAILED",
  "WRE_INTERNAL",
]);

// ── Locked element × property × value matrix ───────────────────────────

export interface CommandMatrixEntry {
  readonly element: "calculator_buttons";
  readonly property: "corners";
  readonly valid_values: readonly ("sharp" | "rounded_sm" | "rounded_md" | "rounded_full")[];
}

export const COMMAND_MATRIX_V1: readonly CommandMatrixEntry[] = Object.freeze([
  {
    element: "calculator_buttons",
    property: "corners",
    valid_values: Object.freeze(["sharp", "rounded_sm", "rounded_md", "rounded_full"]),
  },
]);

// ── Style overrides file shape ─────────────────────────────────────────

export interface StyleOverridesFile {
  readonly $schema_version: "route-2d-tiny-calculator-overrides-v1";
  readonly applied_at: string;
  readonly digit_button_style?: { readonly corners?: string };
  readonly action_button_style?: { readonly corners?: string };
}

export const EMPTY_STYLE_OVERRIDES: StyleOverridesFile = Object.freeze({
  $schema_version: "route-2d-tiny-calculator-overrides-v1",
  applied_at: "1970-01-01T00:00:00.000Z",
});

// ── Request / response shapes ──────────────────────────────────────────

export interface ExecuteStructuredCommandRequest {
  readonly mission_id: string;
  readonly authorisation_ref: string;
  readonly structured: StructuredCommand;
  readonly matched_phrase_id: string;
  readonly current_overrides: StyleOverridesFile;
  readonly authorised_target_root: string;    // absolute path
  readonly authorised_state_file_path: string; // absolute path
  readonly authorised_test_file_relative_path: string;
  readonly clock_iso: string;
  readonly test_timeout_ms?: number; // defaults to 30000
}

export interface FileWriteRecord {
  readonly path: string;
  readonly action: "CREATED" | "MODIFIED" | "UNCHANGED";
  readonly byte_size: number;
  readonly sha256_hex: string;
}

export interface TestRunRecord {
  readonly command: string;
  readonly exit_code: number | null;
  readonly duration_ms: number;
  readonly timed_out: boolean;
  readonly passed: boolean;
  readonly stdout_tail: string;
  readonly stderr_tail: string;
}

export interface ExecuteStructuredCommandSuccess {
  readonly ok: true;
  readonly mission_id: string;
  readonly matched_phrase_id: string;
  readonly next_overrides: StyleOverridesFile;
  readonly file_writes: readonly FileWriteRecord[];
  readonly test_run: TestRunRecord;
  readonly preview_refresh_nonce: number;
  readonly lifecycle_history: readonly {
    readonly at: string;
    readonly state: "CREATED" | "PREPARED" | "AUTHORISED" | "EXECUTING" | "TESTING" | "VERIFIED" | "COMPLETED";
    readonly note: string;
  }[];
  readonly grep_marker: "§36-W-3 · W-3 · 2026-09-15 · workstation-execution-bridge";
}

export interface ExecuteStructuredCommandFailure {
  readonly ok: false;
  readonly refusal_code: ExecutionBridgeRefusalCode;
  readonly reason: string;
  readonly offending_field: string | null;
  readonly diagnosis: {
    readonly test_run?: TestRunRecord;
    readonly attempted_writes?: readonly FileWriteRecord[];
  } | null;
  readonly lifecycle_history: readonly {
    readonly at: string;
    readonly state: "CREATED" | "PREPARED" | "AUTHORISED" | "EXECUTING" | "TESTING" | "FAILED" | "REFUSED";
    readonly note: string;
  }[];
  readonly grep_marker: "§36-W-3 · W-3 · 2026-09-15 · workstation-execution-bridge";
}

export type ExecuteStructuredCommandResult = ExecuteStructuredCommandSuccess | ExecuteStructuredCommandFailure;
