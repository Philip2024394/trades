// §36-CMD-1 · CMD-1 · 2026-09-15 · command-parser
// NEX bounded infrastructure · command-parser · 2026-09-15
// Authored as bounded NEX infrastructure per Perpetual Coder Rule · NOT NEX1-authored capability.
//
// Deterministic phrase-lookup parser. Zero LLM. Zero fuzzy matching.
// Refuses everything outside the locked v1 phrase table.

import type {
  ParseCommandFailure,
  ParseCommandResult,
  ParseCommandSuccess,
  StructuredCommand,
} from "./command-parser-types";

const GREP_MARKER = "§36-CMD-1 · CMD-1 · 2026-09-15 · command-parser" as const;

// ── Locked phrase table v1 ──────────────────────────────────────────────
//
// Each row: (phrase_id, regex, structured mapping). Match order matters
// only if two rows share prefixes; the current v1 rows do not overlap.
// Whitespace at edges is tolerated by the leading/trailing `\s*` in the
// regex; the middle whitespace is required to be single-space per the
// founder's rule that "rounded" alone maps to rounded_md.

const LOCKED_PHRASE_TABLE: readonly {
  readonly phrase_id: string;
  readonly regex: RegExp;
  readonly structured: StructuredCommand;
}[] = Object.freeze([
  {
    phrase_id: "buttons_rounded_md",
    regex: /^\s*make\s+(the\s+)?(calculator\s+)?buttons?\s+rounded\s*$/i,
    structured: { target_app: "tiny-calculator", element: "calculator_buttons", property: "corners", value: "rounded_md" },
  },
  {
    phrase_id: "buttons_rounded_full",
    regex: /^\s*make\s+(the\s+)?(calculator\s+)?buttons?\s+(fully\s+rounded|pill)\s*$/i,
    structured: { target_app: "tiny-calculator", element: "calculator_buttons", property: "corners", value: "rounded_full" },
  },
  {
    phrase_id: "buttons_rounded_sm",
    regex: /^\s*make\s+(the\s+)?(calculator\s+)?buttons?\s+(slightly\s+rounded|softly\s+rounded)\s*$/i,
    structured: { target_app: "tiny-calculator", element: "calculator_buttons", property: "corners", value: "rounded_sm" },
  },
  {
    phrase_id: "buttons_sharp",
    regex: /^\s*make\s+(the\s+)?(calculator\s+)?buttons?\s+(sharp|square)\s*$/i,
    structured: { target_app: "tiny-calculator", element: "calculator_buttons", property: "corners", value: "sharp" },
  },
]);

const MAX_INPUT_LENGTH = 200;

// ── Failure helper ─────────────────────────────────────────────────────

function fail(
  refusal_code: ParseCommandFailure["refusal_code"],
  reason: string,
  offending_input: string,
  suggested_amendment: string | null = null,
): ParseCommandFailure {
  return {
    ok: false,
    refusal_code,
    reason,
    offending_input,
    suggested_amendment,
    grep_marker: GREP_MARKER,
  };
}

// ── Prohibited substring check (reuses NEX safety-substring discipline) ─

const PROHIBITED_SUBSTRINGS: readonly string[] = Object.freeze([
  "\0", "eval(", "Function(", "new Function", "child_process", "__proto__", "constructor.prototype", "<script", "</script", "javascript:", "onerror=", "onload=",
]);

function containsProhibited(s: string): boolean {
  for (const p of PROHIBITED_SUBSTRINGS) if (s.includes(p)) return true;
  return false;
}

// ── Entry point ────────────────────────────────────────────────────────

export function parseFounderCommand(input: unknown): ParseCommandResult {
  if (typeof input !== "string") {
    return fail("CMD_INVALID_INPUT", "input must be a string", String(input ?? ""));
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return fail("CMD_INVALID_INPUT", "input is empty", input);
  }
  if (trimmed.length > MAX_INPUT_LENGTH) {
    return fail("CMD_INVALID_INPUT", `input exceeds ${MAX_INPUT_LENGTH} chars`, input);
  }
  if (containsProhibited(trimmed)) {
    return fail("CMD_INVALID_INPUT", "input contains prohibited substring", input);
  }

  const matches = LOCKED_PHRASE_TABLE.filter((row) => row.regex.test(trimmed));
  if (matches.length === 0) {
    return fail(
      "CMD_UNKNOWN_PATTERN",
      "no phrase in the locked v1 command table matches this input",
      input,
      "expand the §36-CMD-1 phrase table via a subsequent bounded amendment (each new phrase must include an explicit structured mapping)",
    );
  }
  if (matches.length > 1) {
    return fail(
      "CMD_AMBIGUOUS_PATTERN",
      `input matched ${matches.length} phrases (ids: ${matches.map((m) => m.phrase_id).join(", ")}) · locked table must be updated to remove overlap`,
      input,
    );
  }

  const success: ParseCommandSuccess = {
    ok: true,
    structured: matches[0].structured,
    matched_phrase_id: matches[0].phrase_id,
    grep_marker: GREP_MARKER,
  };
  return success;
}

// Re-export the locked phrase-id list for downstream introspection (e.g., docs).
export const LOCKED_PHRASE_IDS: readonly string[] = Object.freeze(LOCKED_PHRASE_TABLE.map((r) => r.phrase_id));
