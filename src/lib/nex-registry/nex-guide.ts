// src/lib/nex-registry/nex-guide.ts
//
// NEX Guide · Spatial Guidance Engine (Ledger B · Zero LLM)
//
// FOUNDER SCENARIO
//   User: "How do I export my app?"
//   NEX:  resolveIntent("how do I export my app?", "workstation")
//     → RESOLVED { target: export_menu_item }
//   Orb enters GUIDING · renders laser to the target · target glows
//   User clicks Export.
//   Orb returns to IDLE.
//
// FOUNDER PRINCIPLE
//   The Orb is the PHYSICAL EXPRESSION of a verified target · not a mascot.
//   NEX does not tell the customer where something probably is.
//   NEX resolves the real interface element and guides the customer to it.
//
// ANTI-FABRICATION INVARIANTS
//   1. resolveIntent returns AMBIGUOUS when multiple targets match ·
//      never picks the first one silently
//   2. resolveIntent returns NOT_FOUND when no target matches ·
//      never invents a phantom target
//   3. State transitions are deterministic · never fabricated
//   4. Rule 6 · guide action MUST record customer_authorization for any
//      side_effect_kind = "invocation"

import { findByIntent, getUiElement, type SemanticUiElement, type SemanticUiScope } from "./nex-ui-semantic-graph";
import { assertRule6GuideAction, type GuideActionEvidence } from "./capability-rule";

export const NEX_GUIDE_VERSION = "nex-guide.v1.2026-09-19";

// ── LiveUiState · founder-directed extension ──────────────────────────
// A snapshot of what the browser actually reports · MUST be produced by a
// real DOM probe · the caller is responsible for populating this from a
// live document.querySelector-and-visibility pass. resolveIntentGrounded
// refuses to fabricate a live_state.
export interface LiveUiState {
  // Set of css_selectors observed to have a matching element in the DOM
  // AND to be visible + enabled at probe time.
  readonly visible_selectors: ReadonlySet<string>;
  // ISO timestamp of the probe.
  readonly probed_at_iso: string;
  // Which browser viewport was probed (informational · not filter).
  readonly viewport?: "desktop" | "tablet-portrait" | "tablet-landscape" | "mobile-portrait" | "mobile-landscape";
}

// ── State machine · founder-authored ──────────────────────────────────
export type GuideState =
  | "IDLE"
  | "OBSERVING"
  | "HELP_AVAILABLE"
  | "ASKING"
  | "TARGET_FOUND"
  | "GUIDING"
  | "ACTION_AVAILABLE"
  | "COMPLETE";

export type GuideEvent =
  | { kind: "customer_typed_intent"; text: string; scope?: SemanticUiScope }
  | { kind: "customer_clicked_orb" }
  | { kind: "customer_selected_marker"; marker_id: string }
  | { kind: "customer_authorized_action" }
  | { kind: "customer_reached_target" }
  | { kind: "target_illuminated" }
  | { kind: "ambiguity_needs_choice" }
  | { kind: "timeout_return_idle" };

// ── Deterministic transition table ────────────────────────────────────
// Explicit · exhaustive · never fabricates a state.
export function advanceState(current: GuideState, event: GuideEvent): GuideState {
  switch (current) {
    case "IDLE":
      if (event.kind === "customer_typed_intent")  return "OBSERVING";
      if (event.kind === "customer_clicked_orb")   return "ASKING";
      return "IDLE";
    case "OBSERVING":
      if (event.kind === "ambiguity_needs_choice") return "ASKING";
      if (event.kind === "target_illuminated")     return "TARGET_FOUND";
      if (event.kind === "timeout_return_idle")    return "IDLE";
      return "OBSERVING";
    case "HELP_AVAILABLE":
      if (event.kind === "customer_clicked_orb")   return "ASKING";
      if (event.kind === "timeout_return_idle")    return "IDLE";
      return "HELP_AVAILABLE";
    case "ASKING":
      if (event.kind === "customer_selected_marker") return "TARGET_FOUND";
      if (event.kind === "customer_typed_intent")    return "OBSERVING";
      if (event.kind === "timeout_return_idle")      return "IDLE";
      return "ASKING";
    case "TARGET_FOUND":
      if (event.kind === "target_illuminated")     return "GUIDING";
      if (event.kind === "timeout_return_idle")    return "IDLE";
      return "TARGET_FOUND";
    case "GUIDING":
      if (event.kind === "customer_reached_target")     return "COMPLETE";
      if (event.kind === "customer_authorized_action")  return "ACTION_AVAILABLE";
      if (event.kind === "timeout_return_idle")         return "IDLE";
      return "GUIDING";
    case "ACTION_AVAILABLE":
      if (event.kind === "customer_reached_target")     return "COMPLETE";
      if (event.kind === "timeout_return_idle")         return "IDLE";
      return "ACTION_AVAILABLE";
    case "COMPLETE":
      if (event.kind === "timeout_return_idle")         return "IDLE";
      return "COMPLETE";
    default:
      return current;
  }
}

// ── Intent resolution outcome (static graph only · no browser probe) ──
export type IntentResolutionOutcome =
  | { readonly outcome: "RESOLVED"; readonly target: SemanticUiElement; readonly next_state: "TARGET_FOUND" }
  | { readonly outcome: "AMBIGUOUS"; readonly candidates: readonly SemanticUiElement[]; readonly next_state: "ASKING"; readonly clarifying_question: string }
  | { readonly outcome: "NOT_FOUND"; readonly rationale: string; readonly next_state: "IDLE" };

// ── Grounded intent resolution outcome (adds NOT_AVAILABLE) ───────────
// Distinguishes three failure modes:
//   NOT_FOUND     · no semantic target matches the intent (graph empty for this intent)
//   NOT_AVAILABLE · semantic target exists but its real DOM element is not visible/enabled
//   AMBIGUOUS     · multiple live targets match
export type GroundedIntentResolutionOutcome =
  | { readonly outcome: "RESOLVED"; readonly target: SemanticUiElement; readonly next_state: "TARGET_FOUND" }
  | { readonly outcome: "AMBIGUOUS"; readonly candidates: readonly SemanticUiElement[]; readonly next_state: "ASKING"; readonly clarifying_question: string }
  | { readonly outcome: "NOT_FOUND"; readonly rationale: string; readonly next_state: "IDLE" }
  | { readonly outcome: "NOT_AVAILABLE"; readonly matched_but_not_live: readonly SemanticUiElement[]; readonly rationale: string; readonly next_state: "IDLE" };

// ── Intent tokeniser · deterministic · never LLM ──────────────────────
function tokenise(text: string): readonly string[] {
  // Extract keyword-shaped tokens. Case-insensitive. Filter stopwords.
  const STOPWORDS = new Set([
    "how", "do", "i", "the", "a", "an", "to", "my", "app", "application", "please",
    "can", "you", "show", "me", "where", "is", "are", "this", "that", "these", "those",
    "want", "would", "like",
  ]);
  const raw = text.toLowerCase().replace(/[^a-z0-9 \-]/g, " ").split(/\s+/).filter((t) => t.length > 0 && !STOPWORDS.has(t));
  // Two-word bigrams for phrases (e.g. "get code" · "put online")
  const bigrams: string[] = [];
  for (let i = 0; i < raw.length - 1; i++) bigrams.push(`${raw[i]} ${raw[i + 1]}`);
  return Object.freeze([...raw, ...bigrams]);
}

// ── Resolve intent · static graph only · anti-fabrication ─────────────
export function resolveIntent(input: { text: string; scope?: SemanticUiScope }): IntentResolutionOutcome {
  const tokens = tokenise(input.text);
  if (tokens.length === 0) {
    return { outcome: "NOT_FOUND", rationale: "no keywords extracted from customer text", next_state: "IDLE" };
  }
  const candidates = findByIntent(tokens, input.scope);
  if (candidates.length === 0) {
    return { outcome: "NOT_FOUND", rationale: `no registered UI element has intent_tags matching any of: ${tokens.slice(0, 6).join(", ")}`, next_state: "IDLE" };
  }
  if (candidates.length === 1) {
    return { outcome: "RESOLVED", target: candidates[0], next_state: "TARGET_FOUND" };
  }
  // Multiple candidates · ask · never pick silently
  return {
    outcome: "AMBIGUOUS",
    candidates: Object.freeze(candidates),
    next_state: "ASKING",
    clarifying_question: `I found ${candidates.length} matches: ${candidates.map((c) => c.customer_label).join(" · ")}. Which one?`,
  };
}

// ── Resolve intent · GROUNDED · requires real live_state ──────────────
//
// Founder anti-fabrication contract:
//   "The orb should never locate a button by guessing pixels. Every
//    interactive Workstation element must have a NEX semantic identity."
//
// This function MUST NOT be called with a synthesized live_state. The
// caller is responsible for producing a real browser probe:
//   1. document.querySelectorAll('[data-nex-ui]') on the live page
//   2. filter to visible + enabled elements
//   3. collect their CSS selectors into visible_selectors
//   4. call resolveIntentGrounded(text, live_state)
//
// The function itself cannot detect a fabricated live_state · that
// discipline is on the caller. But this function will honestly report
// NOT_AVAILABLE when a target exists in the graph but not in live_state.
export function resolveIntentGrounded(input: {
  text: string;
  scope?: SemanticUiScope;
  live_state: LiveUiState;
}): GroundedIntentResolutionOutcome {
  const tokens = tokenise(input.text);
  if (tokens.length === 0) {
    return { outcome: "NOT_FOUND", rationale: "no keywords extracted from customer text", next_state: "IDLE" };
  }
  const semanticCandidates = findByIntent(tokens, input.scope);
  if (semanticCandidates.length === 0) {
    return { outcome: "NOT_FOUND", rationale: `no registered UI element has intent_tags matching any of: ${tokens.slice(0, 6).join(", ")}`, next_state: "IDLE" };
  }
  // Split candidates: which are live in the current DOM state?
  const live: SemanticUiElement[] = [];
  const notLive: SemanticUiElement[] = [];
  for (const c of semanticCandidates) {
    // Element is live if:
    //   (a) availability is not "not_available" AND
    //   (b) either its css_selector is in visible_selectors · or it has no selector but caller declared it live via a matching data-nex-ui attribute
    if (c.availability === "not_available") { notLive.push(c); continue; }
    if (c.css_selector && input.live_state.visible_selectors.has(c.css_selector)) { live.push(c); continue; }
    notLive.push(c);
  }
  if (live.length === 0) {
    return {
      outcome: "NOT_AVAILABLE",
      matched_but_not_live: Object.freeze(notLive),
      rationale: `${notLive.length} semantic match(es) exist in the graph but none is currently visible in the live workstation state`,
      next_state: "IDLE",
    };
  }
  if (live.length === 1) {
    return { outcome: "RESOLVED", target: live[0], next_state: "TARGET_FOUND" };
  }
  return {
    outcome: "AMBIGUOUS",
    candidates: Object.freeze(live),
    next_state: "ASKING",
    clarifying_question: `I found ${live.length} matches that are live: ${live.map((c) => c.customer_label).join(" · ")}. Which one?`,
  };
}

// ── Guide action ledger · every action check-gated by Rule 6 ──────────
export interface GuideActionOutcome {
  readonly outcome: "PERFORMED" | "REJECTED_RULE_6";
  readonly action: GuideActionEvidence;
  readonly violations: readonly string[];
  readonly performed_at_iso: string;
}

export function performGuideAction(action: GuideActionEvidence): GuideActionOutcome {
  const violations = assertRule6GuideAction(action);
  if (violations.length > 0) {
    return {
      outcome: "REJECTED_RULE_6",
      action,
      violations: Object.freeze(violations),
      performed_at_iso: new Date().toISOString(),
    };
  }
  return {
    outcome: "PERFORMED",
    action,
    violations: Object.freeze([]),
    performed_at_iso: new Date().toISOString(),
  };
}

// ── Guide session receipt · joins state + resolution + action ─────────
export interface GuideSessionReceipt {
  readonly session_id: string;
  readonly customer_text: string;
  readonly scope: SemanticUiScope | null;
  readonly resolution: IntentResolutionOutcome;
  readonly initial_state: GuideState;
  readonly final_state: GuideState;
  readonly actions: readonly GuideActionOutcome[];
  readonly generated_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

let SESSION_SEQ = 0;

export function runGuideSession(input: {
  customer_text: string;
  scope?: SemanticUiScope;
  initial_state?: GuideState;
}): GuideSessionReceipt {
  const start: GuideState = input.initial_state ?? "IDLE";
  const afterIntent = advanceState(start, { kind: "customer_typed_intent", text: input.customer_text, scope: input.scope });
  const resolution = resolveIntent({ text: input.customer_text, scope: input.scope });

  let finalState: GuideState;
  if (resolution.outcome === "RESOLVED") {
    finalState = advanceState(afterIntent, { kind: "target_illuminated" });
  } else if (resolution.outcome === "AMBIGUOUS") {
    finalState = advanceState(afterIntent, { kind: "ambiguity_needs_choice" });
  } else {
    finalState = advanceState(afterIntent, { kind: "timeout_return_idle" });
  }

  SESSION_SEQ += 1;
  return {
    session_id: `guide_${Date.now()}_${SESSION_SEQ}`,
    customer_text: input.customer_text,
    scope: input.scope ?? null,
    resolution,
    initial_state: start,
    final_state: finalState,
    actions: Object.freeze([]),
    generated_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}
