// src/lib/nex-agent/code-engine/capability-response-composer.ts
//
// NEX1 · NATIVE CONVERSATIONAL RESPONSE COMPOSER · deterministic · zero LLM.
// Founder-authorised 2026-09-17.
//
// PURPOSE
//   Transform structured NEX1 state into a single human-readable sentence (or
//   short paragraph) that the workstation-chat UI can render as NEX1's reply.
//
//   Consumes:
//     · Nex1IntentClassified / Nex1IntentRefused (from capability A)
//     · SpecificationDrivenLoopResult (from spec-driven coding loop)
//     · InvestigationEvidencePacket (from native investigation mode) · not
//       required for this initial adapter; hook shape is provided
//     · A minimal ConversationTurnContext for "it/that" resolution
//
//   Emits:
//     · text · a single human-readable string
//     · state · the classified conversational state (13 values)
//     · slots · the exact structural values used to fill the template
//               (proves the composer did not fabricate content)
//     · zero_llm: true
//
// DISCIPLINE
//   · Zero LLM. Zero external network. Zero fabrication.
//   · No task-specific hardcoded answers. Templates use slot fills from
//     structured state — the actual verified values, not invented text.
//   · Grammar is deterministic English composition · language-level, not
//     domain-specific (no pricing, staircase, quantity, React vocabulary).
//   · Every state emits a truthful sentence · §11 of the mission preserved:
//     · "verified" only when a real modification + vitest pass occurred
//     · "found" only when structural evidence exists
//     · "unavailable" for capabilities that genuinely do not exist
//
// GENERALIZED · NOT TASK-SPECIFIC
//   The composer knows nothing about pricing.ts, staircase, quantity, or any
//   business domain. Every user-facing sentence is assembled from state fields
//   that come from the loop's actual runtime evidence.

import type {
  Nex1IntentClassified,
  Nex1IntentRefused,
  Nex1IntentResult,
} from "./capability-a-founder-intent/types";

// ── Public shape ─────────────────────────────────────────────────────────

/** Conversational states the composer covers. */
export type ChatConversationState =
  | "understood"
  | "clarification_required"
  | "investigating"
  | "waiting_for_authorization"
  | "working"
  | "verification_running"
  | "verified"
  | "failed"
  | "refused"
  | "insufficient_evidence"
  | "capability_unavailable"
  | "external_authorization_required"
  | "completed"
  | "cancelled"
  // World-class conversation intelligence states · 2026-09-17
  | "bind_acknowledged"
  | "recall_binding"
  | "recall_findings"
  | "recall_mutation"
  | "recall_verification"
  | "recall_decision"
  | "recall_transcript"
  | "recall_insufficient"
  | "thread_switched"
  | "thread_returned";

/** Minimal conversation-turn context the composer may reference for
 *  pronoun resolution and follow-up phrasing. */
export interface ConversationTurnContext {
  readonly conversation_id: string;
  readonly turn_id: number;
  readonly active_target: string | null;      // e.g. "src/lib/nex-shop/pricing.ts"
  readonly active_task_verb: string | null;   // e.g. "investigate", "fix"
  readonly pending_clarification: string | null;
  readonly last_verified_result: string | null; // brief summary if applicable
}

/** A structured spec-driven loop or investigation summary the composer can
 *  render. Kept minimal · every field is a real runtime datum. */
export interface Nex1RuntimeSummary {
  readonly state: ChatConversationState;
  /** Verb-family the classifier picked (INVESTIGATE / FIX / TEST / etc.) */
  readonly verb_family: string | null;
  /** File / function / field targeted (verbatim from runtime state) */
  readonly target_file: string | null;
  readonly target_function: string | null;
  readonly target_field: string | null;
  /** Concrete mutation applied · null when no CHANGE stage ran */
  readonly mutation: {
    readonly current_literal: string;
    readonly proposed_literal: string;
    readonly line: number | null;
  } | null;
  /** Named refusal reason from the underlying capability */
  readonly refusal_kind: string | null;
  /** One-sentence rationale from the loop · verbatim */
  readonly rationale: string | null;
  /** Ambiguity or clarification descriptors */
  readonly ambiguities: readonly string[];
  /** Explicit list of files / candidates NEX1 is looking at */
  readonly candidate_targets: readonly string[];
  /** How many test cases were generated (spec-driven loop) */
  readonly generated_cases: number;
  /** Real vitest exit code, if any stage ran vitest */
  readonly test_exit_code: number | null;
  /** Number of preserved / regressed sibling tests */
  readonly preservation_result:
    | { readonly kind: "no_sibling" | "preserved"; readonly failing_test?: undefined }
    | { readonly kind: "regressed"; readonly failing_test: string }
    | null;
  /** Named capability that was requested but does not exist */
  readonly unavailable_capability: string | null;
  /** External authorization surface (Supabase / Firebase / Vercel / etc.) */
  readonly external_authorization: string | null;
}

/** The composer's output. */
export interface ComposedResponse {
  readonly text: string;
  readonly state: ChatConversationState;
  readonly slots: Readonly<Record<string, string>>;
  readonly zero_llm: true;
  readonly evidence_kind: "COMPOSED";
}

// ── Utility · quote / render slot values ───────────────────────────────

function renderPath(p: string | null): string {
  if (!p) return "the file";
  return "`" + p + "`";
}

function renderIdent(s: string | null | undefined): string {
  return s ? "`" + s + "`" : "the value";
}

function joinList(items: readonly string[], max: number): string {
  const bounded = items.slice(0, max);
  if (bounded.length === 0) return "none";
  if (bounded.length === 1) return "`" + bounded[0] + "`";
  if (bounded.length === 2) return "`" + bounded[0] + "` and `" + bounded[1] + "`";
  const head = bounded.slice(0, -1).map((x) => "`" + x + "`").join(", ");
  const tail = "`" + bounded[bounded.length - 1] + "`";
  return `${head}, and ${tail}`;
}

// ── State templates ──────────────────────────────────────────────────────

interface TemplateInput {
  readonly summary: Nex1RuntimeSummary;
  readonly ctx: ConversationTurnContext;
  readonly classification: Nex1IntentResult | null;
  readonly user_message: string;
}

type Template = (t: TemplateInput) => { text: string; slots: Record<string, string> };

const TEMPLATES: Record<ChatConversationState, Template> = {
  understood: ({ summary }) => {
    const verb = summary.verb_family?.toLowerCase() ?? "handle";
    const target = summary.target_file;
    const text = target
      ? `Understood — I'll ${verb} ${renderPath(target)}.`
      : `Understood. I'm working on the request.`;
    return { text, slots: { verb, target: target ?? "" } };
  },

  clarification_required: ({ summary }) => {
    if (summary.candidate_targets.length > 1) {
      const list = joinList(summary.candidate_targets, 4);
      const kind =
        summary.candidate_targets.length === 2 ? "either of two" :
        `${summary.candidate_targets.length}`;
      return {
        text: `I need one more detail before I can continue. Multiple candidates match your request — ${list}. Which would you like me to work on?`,
        slots: { candidates: summary.candidate_targets.slice(0, 4).join("|"), count: String(summary.candidate_targets.length) },
      };
    }
    const first = summary.ambiguities[0] ?? "your intent";
    return {
      text: `I need one more detail before I can continue. Specifically, ${first}. Could you clarify?`,
      slots: { detail: first },
    };
  },

  investigating: ({ summary }) => {
    const target = summary.target_file;
    if (summary.candidate_targets.length > 0) {
      return {
        text: `Investigating — I'm inspecting ${summary.candidate_targets.length} candidate file(s) before deciding what to change.`,
        slots: { count: String(summary.candidate_targets.length) },
      };
    }
    return {
      text: target
        ? `Investigating ${renderPath(target)} — checking the evidence before I do anything else.`
        : `Investigating the request — checking the evidence before I do anything else.`,
      slots: { target: target ?? "" },
    };
  },

  waiting_for_authorization: ({ summary }) => {
    const parts: string[] = [];
    if (summary.mutation && summary.target_file) {
      parts.push(
        `I found a change: in ${renderPath(summary.target_file)}` +
          (summary.target_function ? `, function ${renderIdent(summary.target_function)}` : "") +
          `, replace \`${summary.mutation.current_literal}\` with \`${summary.mutation.proposed_literal}\`` +
          (summary.mutation.line !== null ? ` on line ${summary.mutation.line}` : "") +
          ".",
      );
    }
    parts.push("This requires authorization before I modify the file.");
    return { text: parts.join(" "), slots: {
      target: summary.target_file ?? "",
      fn: summary.target_function ?? "",
      current: summary.mutation?.current_literal ?? "",
      proposed: summary.mutation?.proposed_literal ?? "",
    } };
  },

  working: ({ summary }) => {
    const verb = summary.verb_family?.toLowerCase() ?? "working";
    const target = summary.target_file;
    return {
      text: target
        ? `Working — ${verb} ${renderPath(target)} now.`
        : `Working — running the ${verb} operation now.`,
      slots: { verb, target: target ?? "" },
    };
  },

  verification_running: ({ summary }) => {
    const cases = summary.generated_cases;
    const target = summary.target_file;
    return {
      text: cases > 0
        ? `Running verification — ${cases} generated test case(s) against ${renderPath(target)}.`
        : `Running verification against ${renderPath(target)}.`,
      slots: { cases: String(cases), target: target ?? "" },
    };
  },

  verified: ({ summary }) => {
    const bits: string[] = [];
    if (summary.mutation && summary.target_file) {
      bits.push(
        `I made the change: in ${renderPath(summary.target_file)}` +
          (summary.target_function ? `, function ${renderIdent(summary.target_function)}` : "") +
          `, I replaced \`${summary.mutation.current_literal}\` with \`${summary.mutation.proposed_literal}\`` +
          (summary.mutation.line !== null ? ` on line ${summary.mutation.line}` : "") +
          `.`,
      );
    } else if (summary.target_file) {
      bits.push(`I completed the operation on ${renderPath(summary.target_file)}.`);
    } else {
      bits.push(`I completed the operation.`);
    }
    if (summary.test_exit_code === 0) {
      bits.push(`Vitest passed after the change` + (summary.preservation_result?.kind === "preserved" ? ` and existing sibling tests remain green.` : `.`));
    }
    return { text: bits.join(" "), slots: {
      target: summary.target_file ?? "",
      fn: summary.target_function ?? "",
      current: summary.mutation?.current_literal ?? "",
      proposed: summary.mutation?.proposed_literal ?? "",
      exit_code: summary.test_exit_code !== null ? String(summary.test_exit_code) : "",
      preservation: summary.preservation_result?.kind ?? "",
    } };
  },

  failed: ({ summary }) => {
    if (summary.preservation_result?.kind === "regressed") {
      return {
        text:
          `I identified a candidate change but did NOT apply it — the existing sibling test \`${summary.preservation_result.failing_test}\` would have failed. The file is unchanged. This is a specification conflict that needs your decision.`,
        slots: {
          failing_test: summary.preservation_result.failing_test,
          target: summary.target_file ?? "",
        },
      };
    }
    const stage = summary.refusal_kind ?? "an unspecified stage";
    return {
      text: `The operation did not complete. It stopped at ${stage}. I have not reported it as done.`,
      slots: { refusal: summary.refusal_kind ?? "" },
    };
  },

  refused: ({ summary, classification }) => {
    // classification-refused case
    if (classification && classification.kind === "refused") {
      return {
        text: `I couldn't classify your request (${classification.refusal}). ${classification.reason}. Could you rephrase?`,
        slots: { refusal_kind: classification.refusal, reason: classification.reason },
      };
    }
    return {
      text: `I refused this operation. Reason: ${summary.refusal_kind ?? "unspecified"}.`,
      slots: { refusal_kind: summary.refusal_kind ?? "" },
    };
  },

  insufficient_evidence: ({ summary }) => {
    const detail = summary.rationale ?? "I don't have enough evidence to determine the correct target yet.";
    return { text: detail, slots: { rationale: summary.rationale ?? "" } };
  },

  capability_unavailable: ({ summary }) => {
    const cap = summary.unavailable_capability ?? "the requested capability";
    return {
      text: `I understand the request, but ${cap} isn't currently available in NEX1's native runtime.`,
      slots: { capability: cap },
    };
  },

  external_authorization_required: ({ summary }) => {
    const surface = summary.external_authorization ?? "an external service";
    return {
      text: `To continue I need authorization for ${surface}. NEX1 will not proceed without your explicit approval.`,
      slots: { surface },
    };
  },

  completed: ({ summary }) => ({
    text: summary.rationale ?? `Completed.`,
    slots: { rationale: summary.rationale ?? "" },
  }),

  cancelled: () => ({
    text: `Cancelled. I've stopped the current operation and kept the previous state.`,
    slots: {},
  }),

  // ── World-class conversation intelligence states · 2026-09-17 ────────
  bind_acknowledged: ({ summary }) => {
    const name = summary.rationale ?? "the entity";
    return { text: `Noted. I've stored ${renderIdent(name)} for later reference.`, slots: { name } };
  },
  recall_binding: ({ summary }) => {
    const name = summary.rationale ?? null;
    return name
      ? { text: `You called it ${renderIdent(name)}.`, slots: { name } }
      : { text: `I don't have that binding stored yet.`, slots: {} };
  },
  recall_findings: ({ summary }) => {
    if (summary.candidate_targets.length === 0) {
      return { text: `I haven't investigated anything yet in this thread.`, slots: {} };
    }
    const list = joinList(summary.candidate_targets, 4);
    return {
      text: `Earlier I inspected ${summary.candidate_targets.length} candidate file(s): ${list}.`,
      slots: { count: String(summary.candidate_targets.length) },
    };
  },
  recall_mutation: ({ summary }) => {
    if (!summary.mutation || !summary.target_file) {
      return { text: `No mutation has been applied yet in this thread.`, slots: {} };
    }
    const fn = summary.target_function;
    return {
      text: `The change I made: in ${renderPath(summary.target_file)}${fn ? `, function ${renderIdent(fn)}` : ""}, I replaced \`${summary.mutation.current_literal}\` with \`${summary.mutation.proposed_literal}\`${summary.mutation.line !== null ? ` on line ${summary.mutation.line}` : ""}.`,
      slots: {
        target: summary.target_file,
        current: summary.mutation.current_literal,
        proposed: summary.mutation.proposed_literal,
      },
    };
  },
  recall_verification: ({ summary }) => {
    if (summary.test_exit_code === null) {
      return { text: `No verification has run yet in this thread.`, slots: {} };
    }
    if (summary.test_exit_code === 0) {
      const pres = summary.preservation_result?.kind === "preserved" ? " Existing sibling tests remained green." : "";
      return { text: `Yes — vitest passed after the change (exit_code=0).${pres}`, slots: { exit: "0" } };
    }
    if (summary.preservation_result?.kind === "regressed") {
      return {
        text: `No — the change was reverted because the existing test \`${summary.preservation_result.failing_test}\` would have failed.`,
        slots: { failing_test: summary.preservation_result.failing_test },
      };
    }
    return { text: `Verification did not confirm success (exit_code=${summary.test_exit_code}).`, slots: {} };
  },
  recall_decision: ({ summary }) => {
    if (!summary.rationale) {
      return { text: `I don't have a decision recorded for this thread yet.`, slots: {} };
    }
    return { text: `Recorded decision: ${summary.rationale}`, slots: { decision: summary.rationale } };
  },
  recall_transcript: ({ summary }) => ({
    text: summary.rationale ?? `I don't have that turn stored.`,
    slots: { rationale: summary.rationale ?? "" },
  }),
  recall_insufficient: () => ({
    text: `I don't have enough conversation history to answer that safely.`,
    slots: {},
  }),
  thread_switched: ({ summary }) => ({
    text: `Alright — leaving the previous thread. ${summary.rationale ?? "Waiting for the new subject."}`,
    slots: { rationale: summary.rationale ?? "" },
  }),
  thread_returned: ({ summary }) => ({
    text: `Back to ${summary.target_file ? renderPath(summary.target_file) : "the previous thread"}.`,
    slots: { target: summary.target_file ?? "" },
  }),
};

// ── Public entry ─────────────────────────────────────────────────────────

export interface ComposeChatResponseInput {
  readonly user_message: string;
  readonly classification: Nex1IntentResult | null;
  readonly summary: Nex1RuntimeSummary;
  readonly ctx: ConversationTurnContext;
}

/** Compose a single human-readable response line from structured state.
 *  Deterministic · zero LLM · truthful. */
export function composeChatResponse(input: ComposeChatResponseInput): ComposedResponse {
  const tmpl = TEMPLATES[input.summary.state];
  const { text, slots } = tmpl({
    summary: input.summary,
    ctx: input.ctx,
    classification: input.classification,
    user_message: input.user_message,
  });
  return {
    text,
    state: input.summary.state,
    slots,
    zero_llm: true,
    evidence_kind: "COMPOSED",
  };
}

/** Derive a conversational state directly from a classifier result. Used when
 *  the chat turn stops at the classification stage (e.g. refused, ambiguous). */
export function stateFromClassification(c: Nex1IntentResult): ChatConversationState {
  if (c.kind === "refused") return "refused";
  if (c.ambiguities.length > 0) {
    for (const a of c.ambiguities) {
      if (a.kind === "no_domain_extracted" || a.kind === "requirement_phrases_missing") {
        return "clarification_required";
      }
    }
  }
  if (c.overall_confidence < 0.35) return "insufficient_evidence";
  return "understood";
}

/** Convenience · build a minimal summary shell so callers can fill only the
 *  fields they have. */
export function emptySummary(state: ChatConversationState): Nex1RuntimeSummary {
  return {
    state,
    verb_family: null,
    target_file: null,
    target_function: null,
    target_field: null,
    mutation: null,
    refusal_kind: null,
    rationale: null,
    ambiguities: [],
    candidate_targets: [],
    generated_cases: 0,
    test_exit_code: null,
    preservation_result: null,
    unavailable_capability: null,
    external_authorization: null,
  };
}

/** Convenience · empty conversation context (for first-turn use). */
export function emptyContext(conversation_id: string): ConversationTurnContext {
  return {
    conversation_id,
    turn_id: 1,
    active_target: null,
    active_task_verb: null,
    pending_clarification: null,
    last_verified_result: null,
  };
}
