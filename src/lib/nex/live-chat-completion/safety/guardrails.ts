// src/lib/nex/live-chat-completion/safety/guardrails.ts
//
// Founder BEGIN Phase 3.7 · Guardrails abstraction.
//
// Input + Output guardrails with a shared registry. Runs in registered
// order. First BLOCKING result wins for input; every scrubber applies
// in order for output.
//
// Zero LLM. Deterministic. Sub-millisecond.
//
// The chat route runs input guardrails BEFORE domain classification (so
// jailbreaks never touch the retrieval/rescue pipeline) and output
// guardrails AFTER composer, BEFORE SSE tokenization.

export interface InputTurn {
  message: string;
  conversation_id: string | null;
  language?: "en" | "id";
  request_ip?: string | null;
  request_headers?: Record<string, string>;
}

// Founder BEGIN Phase 3.7 Safe Actionable Intelligence (2026-09-09) ·
// verdict types richer than allow/block. Existing allow/block callers
// remain fully compatible · new verdicts are opt-in.
export type InputGuardrailDecision =
  | "allowed"
  | "blocked"
  | "requires_confirmation"
  | "requires_verified_evidence"
  | "requires_human";

export type InputGuardrailVerdict =
  | { allow: true; decision?: "allowed" }
  | {
      allow: false;
      // "blocked" | "requires_confirmation" | "requires_verified_evidence" | "requires_human"
      decision?: InputGuardrailDecision;
      reason: string;
      // Honest customer-visible reply. Never fabricated.
      block_reply: string;
      // Structured category the moderator emits · used by observability.
      category: "jailbreak" | "harmful" | "rate_limit" | "policy" | "abuse" | "confirmation_required" | "evidence_required" | "human_required" | "other";
      // Optional retry hint (HTTP header seconds).
      retry_after_seconds?: number;
      // When decision === "requires_confirmation" the client renders a
      // yes/no UI · confirmation_token is the opaque id it echoes back.
      confirmation_token?: string;
    };

export interface InputGuardrail {
  name: string;
  evaluate(turn: InputTurn): Promise<InputGuardrailVerdict> | InputGuardrailVerdict;
}

export interface OutputTurn {
  reply_text: string;
  entity_ref: string | null;
  intent_slug: string | null;
  language: "en" | "id";
  /** Cited source refs · used to determine "owner-verified" allowlist. */
  cited_source_refs: readonly string[];
}

export type OutputGuardrailDecision =
  | "allowed"
  | "blocked"
  | "requires_confirmation"
  | "requires_verified_evidence"
  | "requires_human";

export type OutputGuardrailVerdict =
  | { pass: true; reply_text: string; decision?: OutputGuardrailDecision }
  | {
      pass: false;
      decision?: OutputGuardrailDecision;
      reason: string;
      block_reply: string;
      confirmation_token?: string;
    };

export interface OutputGuardrail {
  name: string;
  /**
   * Returns either the (possibly-scrubbed) reply_text or a block verdict.
   * Non-blocking scrubbers should always return { pass: true, reply_text }.
   */
  evaluate(out: OutputTurn): Promise<OutputGuardrailVerdict> | OutputGuardrailVerdict;
}

// ═══════════════════════════════════════════════════════════════════
// Registry · in-memory · module singleton
// ═══════════════════════════════════════════════════════════════════

const _inputGuardrails: InputGuardrail[] = [];
const _outputGuardrails: OutputGuardrail[] = [];

export function registerInputGuardrail(g: InputGuardrail): void {
  if (!_inputGuardrails.find((x) => x.name === g.name)) _inputGuardrails.push(g);
}
export function registerOutputGuardrail(g: OutputGuardrail): void {
  if (!_outputGuardrails.find((x) => x.name === g.name)) _outputGuardrails.push(g);
}

export interface InputGuardrailRun {
  fired_guardrail: string | null;   // name of the guardrail that blocked (null → all passed)
  decision: InputGuardrailDecision; // Founder Phase 3.7 · richer than allow/block
  category: string | null;
  reason: string | null;
  block_reply: string | null;
  retry_after_seconds: number | null;
  confirmation_token: string | null;
  ran: string[];                    // names in order
  latency_ms: number;
}

export async function runInputGuardrails(turn: InputTurn): Promise<InputGuardrailRun> {
  const t0 = performance.now();
  const ran: string[] = [];
  for (const g of _inputGuardrails) {
    ran.push(g.name);
    const v = await Promise.resolve(g.evaluate(turn));
    if (!v.allow) {
      return {
        fired_guardrail: g.name,
        decision: v.decision ?? "blocked",
        category: v.category,
        reason: v.reason,
        block_reply: v.block_reply,
        retry_after_seconds: v.retry_after_seconds ?? null,
        confirmation_token: v.confirmation_token ?? null,
        ran,
        latency_ms: Math.round(performance.now() - t0),
      };
    }
  }
  return {
    fired_guardrail: null,
    decision: "allowed",
    category: null,
    reason: null,
    block_reply: null,
    retry_after_seconds: null,
    confirmation_token: null,
    ran,
    latency_ms: Math.round(performance.now() - t0),
  };
}

export interface OutputGuardrailRun {
  original_reply: string;
  final_reply: string;
  blocked: boolean;
  blocked_by: string | null;
  scrubbed_by: readonly string[];  // guardrails that mutated the text
  ran: string[];
  latency_ms: number;
}

export async function runOutputGuardrails(out: OutputTurn): Promise<OutputGuardrailRun> {
  const t0 = performance.now();
  const ran: string[] = [];
  const scrubbed_by: string[] = [];
  const original = out.reply_text;
  let current = out.reply_text;
  for (const g of _outputGuardrails) {
    ran.push(g.name);
    const v = await Promise.resolve(g.evaluate({ ...out, reply_text: current }));
    if (!v.pass) {
      return {
        original_reply: original,
        final_reply: v.block_reply,
        blocked: true,
        blocked_by: g.name,
        scrubbed_by,
        ran,
        latency_ms: Math.round(performance.now() - t0),
      };
    }
    if (v.reply_text !== current) scrubbed_by.push(g.name);
    current = v.reply_text;
  }
  return {
    original_reply: original,
    final_reply: current,
    blocked: false,
    blocked_by: null,
    scrubbed_by,
    ran,
    latency_ms: Math.round(performance.now() - t0),
  };
}

// Test-only reset (never called in production).
export function _resetGuardrailsForTesting(): void {
  _inputGuardrails.length = 0;
  _outputGuardrails.length = 0;
}
