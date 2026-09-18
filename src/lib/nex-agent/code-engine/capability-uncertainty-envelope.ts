// src/lib/nex-agent/code-engine/capability-uncertainty-envelope.ts
//
// NEX1 · C11 · Uncertainty as First-Class Output · 2026-09-17.
// Founder-authorised via frontier §17 queue after C10 Phase 3.
//
// PURPOSE
//   Every task-processing exit point returns a typed `UncertaintyEnvelope`
//   alongside its native result. Consumers (submit route, workstation UI,
//   tests, doctrine enforcers) can reason about the *quality* of a decision
//   without inspecting internal state.
//
// DESIGN INTENT
//   LLMs hallucinate confidence. Zero-LLM systems refuse honestly and offer
//   paths forward. This module makes that discipline mechanical:
//
//     · every result declares a verdict (7-state vocabulary)
//     · every clarify carries the options that were offered
//     · every refuse carries the reason + what would change the outcome
//     · every partial carries what is verified vs what remains
//     · every high-confidence result carries the provenance chain
//
// ZERO LLM · deterministic · pure functions.

// ── Verdict vocabulary · 7 non-overlapping states ─────────────────────

export type UncertaintyVerdict =
  | "confirmed"              // decision made · high confidence · zero LLM
  | "partial"                // decision made · some parts verified · rest not
  | "clarify"                // clarification offered · founder must pick
  | "insufficient_evidence"  // classifier could not act · needs more input
  | "refused"                // deliberately refused (safety, verb-gate, etc.)
  | "not_yet_verified"       // decision made but verification pending
  | "conflicting_evidence";  // multiple sources disagree · needs founder call

// ── Building blocks ──────────────────────────────────────────────────

export interface OptionCandidate {
  readonly id: string;
  readonly label: string;
  readonly preview?: string;
  readonly slug?: string;
}

export interface MissingEvidence {
  readonly kind: "user_input" | "file_read" | "test_run" | "founder_decision" | "authorization" | "other";
  readonly description: string;
}

export interface ProvenanceRef {
  readonly kind: "step_id" | "file_line" | "doctrine" | "trace_key";
  readonly value: string;
}

// ── Envelope ─────────────────────────────────────────────────────────

export interface UncertaintyEnvelope<T = unknown> {
  readonly verdict: UncertaintyVerdict;
  readonly value: T | null;
  readonly confidence: number;           // [0, 1] · 0 = no signal · 1 = certain
  readonly reason: string;               // short human-readable summary
  readonly missing_evidence: readonly MissingEvidence[];
  readonly options: readonly OptionCandidate[];  // populated only when verdict is "clarify" or "conflicting_evidence"
  readonly provenance: readonly ProvenanceRef[]; // where the value came from
  readonly next_action_hint: string | null;      // what the founder should try next
  readonly source: "NEX1_NATIVE";
  readonly zero_llm: true;
}

// ── Deterministic builders · one per verdict for readability ────────

interface BuilderCommon<T> {
  value?: T | null;
  confidence?: number;
  provenance?: readonly ProvenanceRef[];
  next_action_hint?: string | null;
}

function base<T>(over: BuilderCommon<T> = {}): Omit<UncertaintyEnvelope<T>, "verdict" | "reason" | "missing_evidence" | "options"> {
  return {
    value: over.value ?? null,
    confidence: typeof over.confidence === "number" ? clamp01(over.confidence) : 0,
    provenance: over.provenance ?? [],
    next_action_hint: over.next_action_hint ?? null,
    source: "NEX1_NATIVE",
    zero_llm: true,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function buildConfirmed<T>(reason: string, value: T, over: BuilderCommon<T> = {}): UncertaintyEnvelope<T> {
  return { ...base<T>({ value, confidence: 0.9, ...over }), verdict: "confirmed", reason, missing_evidence: [], options: [] };
}
export function buildPartial<T>(reason: string, value: T, missing: readonly MissingEvidence[], over: BuilderCommon<T> = {}): UncertaintyEnvelope<T> {
  return { ...base<T>({ value, confidence: 0.55, ...over }), verdict: "partial", reason, missing_evidence: missing, options: [] };
}
export function buildClarify<T>(reason: string, options: readonly OptionCandidate[], over: BuilderCommon<T> = {}): UncertaintyEnvelope<T> {
  return { ...base<T>({ confidence: 0.4, ...over }), verdict: "clarify", reason, missing_evidence: [{ kind: "user_input", description: "founder must choose one of the options" }], options };
}
export function buildInsufficient<T>(reason: string, missing: readonly MissingEvidence[], over: BuilderCommon<T> = {}): UncertaintyEnvelope<T> {
  return { ...base<T>({ confidence: 0.15, ...over }), verdict: "insufficient_evidence", reason, missing_evidence: missing, options: [] };
}
export function buildRefused<T>(reason: string, over: BuilderCommon<T> = {}): UncertaintyEnvelope<T> {
  return { ...base<T>({ confidence: 0, ...over }), verdict: "refused", reason, missing_evidence: [], options: [] };
}
export function buildNotYetVerified<T>(reason: string, value: T, over: BuilderCommon<T> = {}): UncertaintyEnvelope<T> {
  return { ...base<T>({ value, confidence: 0.6, ...over }), verdict: "not_yet_verified", reason, missing_evidence: [{ kind: "test_run", description: "verification step has not run" }], options: [] };
}
export function buildConflicting<T>(reason: string, options: readonly OptionCandidate[], over: BuilderCommon<T> = {}): UncertaintyEnvelope<T> {
  return { ...base<T>({ confidence: 0.3, ...over }), verdict: "conflicting_evidence", reason, missing_evidence: [{ kind: "founder_decision", description: "sources disagree · founder call needed" }], options };
}

// ── Envelope helpers ────────────────────────────────────────────────

/** True when the envelope carries enough information to act. */
export function isActionable(env: UncertaintyEnvelope<unknown>): boolean {
  return env.verdict === "confirmed" || env.verdict === "not_yet_verified" || env.verdict === "partial";
}

/** True when the envelope requires founder input to progress. */
export function needsFounder(env: UncertaintyEnvelope<unknown>): boolean {
  return env.verdict === "clarify" || env.verdict === "insufficient_evidence" || env.verdict === "conflicting_evidence";
}

/**
 * Compact one-line summary of the envelope · useful for log lines and
 * trace-step titles. Deterministic · O(env fields).
 */
export function summarise(env: UncertaintyEnvelope<unknown>): string {
  const conf = `${(env.confidence * 100).toFixed(0)}%`;
  const opts = env.options.length > 0 ? ` · ${env.options.length} option(s)` : "";
  const miss = env.missing_evidence.length > 0 ? ` · missing ${env.missing_evidence.length}` : "";
  return `${env.verdict} · ${conf}${opts}${miss} · ${env.reason}`;
}
