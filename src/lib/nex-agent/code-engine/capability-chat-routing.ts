// src/lib/nex-agent/code-engine/capability-chat-routing.ts
//
// NEX ↔ NEX1 · Chat routing capability · deterministic · zero LLM.
// Founder-authorised 2026-09-17.
//
// §4-5 of the Unified Chat mission: general routing capability that decides
// whether a message belongs in NEX Chat (broad conversation) or NEX1 Code
// Chat (deep technical workspace). Traceable decision · no magic phrase
// list · no domain-specific hardcoding.
//
// Signals used (all from Capability A's structured classification output):
//   · verb family (FIX / MODIFY / INVESTIGATE / TEST / REFACTOR / VERIFY /
//                   REMOVE / BUILD)
//   · file_references count and shape
//   · coding_concepts count (tool + framework + concept + language tokens)
//   · project_dir_references count
//   · deliverable_kind
//   · overall_confidence
//
// Decision:
//   NEX1_CODE_CHAT  iff any of:
//     (a) file_references.length > 0 AND coding-family verb
//     (b) project_dir_references.length > 0 AND coding-family verb
//     (c) verb ∈ CODING_ACTION_VERBS AND coding_concepts.length ≥ 2
//   NEX_CHAT        otherwise
//
// The routing produces a reason string so a human can inspect the decision.
// No implicit fallback to another provider. No LLM.

import type { Nex1IntentResult } from "./capability-a-founder-intent/types";

// ── Public shape ─────────────────────────────────────────────────────────

export type ChatDestination = "NEX_CHAT" | "NEX1_CODE_CHAT" | "AMBIGUOUS";

export interface ChatRoutingDecision {
  readonly destination: ChatDestination;
  readonly reason: string;
  readonly signals: {
    readonly verb_family: string | null;
    readonly file_references_count: number;
    readonly project_dir_references_count: number;
    readonly coding_concepts_count: number;
    readonly overall_confidence: number;
  };
  readonly zero_llm: true;
}

const CODING_ACTION_VERBS = new Set([
  "FIX",
  "MODIFY",
  "INVESTIGATE",
  "TEST",
  "REFACTOR",
  "VERIFY",
  "REMOVE",
  "BUILD",
]);

/** Decide which chat destination the message belongs in.
 *  Purely from structured classification output · zero LLM. */
export function routeChatMessage(c: Nex1IntentResult): ChatRoutingDecision {
  if (c.kind === "refused") {
    return {
      destination: "NEX_CHAT",
      reason: `classifier_refused (${c.refusal}) · default destination is NEX_CHAT so the user can continue conversationally`,
      signals: {
        verb_family: null,
        file_references_count: 0,
        project_dir_references_count: 0,
        coding_concepts_count: 0,
        overall_confidence: 0,
      },
      zero_llm: true,
    };
  }
  const fileRefs = c.file_references.length;
  const projectDirs = c.project_dir_references.length;
  const codingConcepts = c.coding_concepts.length;
  const verb = c.verb_family;
  const isCodingVerb = CODING_ACTION_VERBS.has(verb);

  // Rule (a): explicit file reference + coding-family verb → Code Chat
  if (fileRefs > 0 && isCodingVerb) {
    return {
      destination: "NEX1_CODE_CHAT",
      reason: `explicit file reference (n=${fileRefs}) + coding verb ${verb} · direct handoff to Code workspace`,
      signals: sig(c),
      zero_llm: true,
    };
  }
  // Rule (b): project dir reference + coding-family verb
  if (projectDirs > 0 && isCodingVerb) {
    return {
      destination: "NEX1_CODE_CHAT",
      reason: `project directory reference (n=${projectDirs}) + coding verb ${verb} · handoff to Code workspace`,
      signals: sig(c),
      zero_llm: true,
    };
  }
  // Rule (c): coding-action verb + multiple coding concepts
  if (isCodingVerb && codingConcepts >= 2) {
    return {
      destination: "NEX1_CODE_CHAT",
      reason: `coding verb ${verb} + ${codingConcepts} coding concepts · handoff to Code workspace`,
      signals: sig(c),
      zero_llm: true,
    };
  }
  // Ambiguous: single coding concept OR coding verb with no target/concepts
  if (isCodingVerb || codingConcepts >= 1) {
    return {
      destination: "AMBIGUOUS",
      reason: `coding-adjacent signals present (verb=${verb} · concepts=${codingConcepts}) but no explicit target · treat as NEX Chat until user confirms`,
      signals: sig(c),
      zero_llm: true,
    };
  }
  return {
    destination: "NEX_CHAT",
    reason: `no coding target · no strong coding intent · general conversation`,
    signals: sig(c),
    zero_llm: true,
  };
}

function sig(c: Extract<Nex1IntentResult, { kind: "classified" }>) {
  return {
    verb_family: c.verb_family,
    file_references_count: c.file_references.length,
    project_dir_references_count: c.project_dir_references.length,
    coding_concepts_count: c.coding_concepts.length,
    overall_confidence: c.overall_confidence,
  };
}

/** Distinguish informational-about-coding ("tell me what TypeScript is") from
 *  actionable coding work ("investigate my TypeScript code"). This is a
 *  helper on top of `routeChatMessage`. */
export function isInformationalCodingQuestion(c: Nex1IntentResult): boolean {
  if (c.kind === "refused") return false;
  if (c.verb_family !== "INVESTIGATE") return false;
  if (c.file_references.length > 0) return false;
  if (c.project_dir_references.length > 0) return false;
  return true;
}
