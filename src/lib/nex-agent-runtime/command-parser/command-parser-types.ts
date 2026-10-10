// §36-CMD-1 · CMD-1 · 2026-09-15 · command-parser
// NEX bounded infrastructure · command-parser types · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.

// ── Locked structured command (matches §36-W-3 execution bridge input) ─

export type StructuredCommandTargetApp = "tiny-calculator";
export type StructuredCommandElement = "calculator_buttons"; // v1 · single element only
export type StructuredCommandProperty = "corners";           // v1 · single property only
export type StructuredCommandValue = "sharp" | "rounded_sm" | "rounded_md" | "rounded_full";

export interface StructuredCommand {
  readonly target_app: StructuredCommandTargetApp;
  readonly element: StructuredCommandElement;
  readonly property: StructuredCommandProperty;
  readonly value: StructuredCommandValue;
}

// ── Refusal codes (locked · 3) ──────────────────────────────────────────

export type CommandParserRefusalCode =
  | "CMD_INVALID_INPUT"
  | "CMD_UNKNOWN_PATTERN"
  | "CMD_AMBIGUOUS_PATTERN";

export const COMMAND_PARSER_REFUSAL_CODES: readonly CommandParserRefusalCode[] = Object.freeze([
  "CMD_INVALID_INPUT",
  "CMD_UNKNOWN_PATTERN",
  "CMD_AMBIGUOUS_PATTERN",
]);

// ── Response shape ──────────────────────────────────────────────────────

export interface ParseCommandSuccess {
  readonly ok: true;
  readonly structured: StructuredCommand;
  readonly matched_phrase_id: string;
  readonly grep_marker: "§36-CMD-1 · CMD-1 · 2026-09-15 · command-parser";
}

export interface ParseCommandFailure {
  readonly ok: false;
  readonly refusal_code: CommandParserRefusalCode;
  readonly reason: string;
  readonly offending_input: string;
  readonly suggested_amendment: string | null;
  readonly grep_marker: "§36-CMD-1 · CMD-1 · 2026-09-15 · command-parser";
}

export type ParseCommandResult = ParseCommandSuccess | ParseCommandFailure;
