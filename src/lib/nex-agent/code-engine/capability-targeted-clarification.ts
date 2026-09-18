// src/lib/nex-agent/code-engine/capability-targeted-clarification.ts
//
// NEX1 · Fix 28 · Targeted Clarification Composer.
// Founder-authorised 2026-09-18.
//
// PURPOSE
//   Turn "clarification_required" from a generic prompt into a targeted
//   question that surfaces the specific slot NEX1 is missing.
//
//   Deterministic template selection based on investigation-packet slots.
//   Never invents; only fills templates with observed data.
//
//   Zero LLM. No dependency on Fix 23a/b/c or Q7/Q8.

export type ClarificationSlot =
  | "TARGET_FILE"
  | "EXPECTED_VALUE"
  | "SUBJECT_FUNCTION"
  | "SCOPE_DIRECTORY"
  | "AMBIGUOUS_CANDIDATE";

export interface TargetedClarificationInput {
  /** The missing slot NEX1 needs the user to fill. */
  readonly missing_slot: ClarificationSlot;
  /** Optional context surfaced to the user in the question. */
  readonly context?: {
    readonly target_file?: string | null;
    readonly discovered_function?: string | null;
    readonly candidate_paths?: readonly string[];
    readonly investigation_verdict?: string | null;
  };
}

export interface TargetedClarification {
  readonly slot: ClarificationSlot;
  readonly text: string;
  readonly hint: string;
  readonly evidence_kind: "COMPOSED";
}

export function composeTargetedClarification(
  input: TargetedClarificationInput,
): TargetedClarification {
  const ctx = input.context ?? {};
  switch (input.missing_slot) {
    case "TARGET_FILE":
      return {
        slot: "TARGET_FILE",
        text: "I need to know which file to look at. Please give me a file path or an exported function name I can search for.",
        hint: "example: `src/lib/nex-shop/pricing.ts` or `computePricing`",
        evidence_kind: "COMPOSED",
      };
    case "EXPECTED_VALUE": {
      const fn = ctx.discovered_function ?? "the function";
      const file = ctx.target_file ?? "the target file";
      return {
        slot: "EXPECTED_VALUE",
        text: `I found ${fn} in ${file} but I do not know what it should return. What value do you expect from ${fn}?`,
        hint: `example: "when ${fn} is called, the result should be 3"`,
        evidence_kind: "COMPOSED",
      };
    }
    case "SUBJECT_FUNCTION": {
      const file = ctx.target_file ?? "the file";
      return {
        slot: "SUBJECT_FUNCTION",
        text: `${file} exports multiple functions. Which function should I focus on?`,
        hint: "reply with the function name",
        evidence_kind: "COMPOSED",
      };
    }
    case "SCOPE_DIRECTORY":
      return {
        slot: "SCOPE_DIRECTORY",
        text: "I need to know which project or directory to search in. Please supply a directory path.",
        hint: "example: `src/lib/nex-shop/` or an absolute path",
        evidence_kind: "COMPOSED",
      };
    case "AMBIGUOUS_CANDIDATE": {
      const list = (ctx.candidate_paths ?? []).slice(0, 6);
      const listText = list.length > 0
        ? " I found: " + list.map((p) => `\`${p}\``).join(", ") + "."
        : "";
      return {
        slot: "AMBIGUOUS_CANDIDATE",
        text: `Multiple candidates match your request.${listText} Which one should I work on?`,
        hint: "reply with the file path",
        evidence_kind: "COMPOSED",
      };
    }
  }
}

export const TARGETED_CLARIFICATION_VERSION = "fix28.v1";
