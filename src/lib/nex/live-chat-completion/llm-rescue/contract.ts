// src/lib/nex/live-chat-completion/llm-rescue/contract.ts
//
// Founder BEGIN Phase 3.4 · LLM Rescue Contract.
//
// Founder rule (2026-09-09, persisted in nex.master_rulebook):
//   "LLM rescue must never bypass the Truth Engine."
//
//   Every LLM invocation on the customer path MUST:
//     1. Receive retrieval evidence (never from thin air).
//     2. Produce output in the strict schema below.
//     3. Have every claim.source_ref match a real evidence item — orphan
//        claims are rejected as fabrication.
//     4. Cap trust at evidence_provisional — never canonical_verified.
//     5. Emit "I couldn't verify that" when evidence is insufficient.
//     6. Record to nex.knowledge_gap so the category resolves it later.
//
// Zero fabrication is the top-line invariant.

import type { TrustBand } from "@/lib/nex/live-chat-completion/contract";

/**
 * A single item of retrieval evidence handed to the LLM. Every claim the
 * LLM makes MUST reference one of these by ref_id.
 */
export interface EvidenceItem {
  ref_id: string;                     // stable id the LLM must cite
  source_type:
    | "canonical_fact"                // from nex.accommodation_business etc.
    | "provenance_row"                // from *_field_provenance
    | "evidence_row"                  // from *_enrichment_evidence
    | "question_variant"              // from nex.question_variant (answered)
    | "web_search"                    // bounded per-turn web acquisition
    | "vision"                        // extracted from a user-uploaded image · Phase 3.8
    | "file";                         // extracted from a user-uploaded file (pdf/text/img) · Phase 3.9
  entity_ref?: string | null;
  intent_slug?: string | null;
  text: string;                       // the actual fact text the LLM may cite
  confidence: number;                 // 0..1
  verified_at?: string | null;        // ISO · used by Truth Engine freshness
  source_reference?: string | null;   // upstream URL / table row / etc.
}

/** Full retrieval bundle passed to the rescue provider. */
export interface RetrievalBundle {
  message: string;
  language: "en" | "id";
  entity_ref?: string | null;
  intent_slug?: string | null;
  items: readonly EvidenceItem[];
  /** Free-form note for the LLM ("user asked X but we couldn't resolve entity"). */
  context_note?: string;
  /**
   * Founder Phase 3.4A spec · last N dialogue turns (bounded) so the LLM
   * can interpret pronouns and follow-ups against real conversation
   * history · not just the current message.
   */
  conversation_context?: readonly {
    role: "user" | "nex";
    text: string;
  }[];
  /**
   * Founder Phase 3.4A spec · what the LLM is ALLOWED to do.
   * cite_or_abstain      · answer only if all claims cite evidence (default).
   * reference_only       · summarise evidence · no synthesis beyond it.
   * strict_uncertainty   · answer with explicit uncertainty markers when
   *                        evidence is weak, still cite what's cited.
   */
  allowed_answer_mode?: "cite_or_abstain" | "reference_only" | "strict_uncertainty";
  /**
   * Founder Phase 3.10 · Doctrine #4 (MEMORY IS NOT TRUTH).
   * user_context carries personalization signals + user-asserted context.
   * It is DISTINCT from items[] · has NO ref_ids · the LLM cannot cite it
   * as evidence · the Fabrication Gate cannot validate a memory citation.
   * It may shape TONE + FORMAT + FILTERING · never authoritative facts.
   */
  user_context?: {
    preferences: readonly { category: string; claim_text: string; confidence: number }[];
    user_asserted: readonly { category: string; claim_text: string; confidence: number }[];
    custom_instructions?: {
      about_user?: string;
      response_style?: string;
      preferred_language?: "en" | "id";
      updated_at?: string;
    };
    user_id_hash: string;
  };
}

// ═══════════════════════════════════════════════════════════════════
// LLM output shape · STRICT · Truth Engine rejects anything else
// ═══════════════════════════════════════════════════════════════════

export interface LlmClaim {
  text: string;                       // human-readable claim text
  source_ref: string;                 // MUST match an EvidenceItem.ref_id
  confidence: number;                 // 0..1 · the LLM's own confidence
}

export interface LlmRescueOutput {
  /** True → LLM made claims. False → LLM abstained (honest unknown). */
  answered: boolean;
  /**
   * True → the LLM believes it needs MORE evidence than what was provided
   * to answer honestly. Signals gap-workers to prioritise this intent.
   */
  requires_evidence?: boolean;
  /** Structured claims. Empty when answered=false. */
  claims: readonly LlmClaim[];
  /** Optional human-facing reply text · derived from claims by composer. */
  reply_hint?: string;
  /** When answered=false, why. Shown to user as honest limitation. */
  unverified_reason?: string;
  /**
   * Founder Phase 3.4A spec · LLM-authored hint of what evidence would
   * resolve this gap. Fed into the knowledge_gap row for the appropriate
   * category worker to research. Never surfaced to the customer.
   *
   *   { intent_slug, entity_ref?, evidence_needed_text }
   */
  suggested_gap?: {
    intent_slug?: string;
    entity_ref?: string;
    evidence_needed_text: string;
  };
  /**
   * Founder Phase 3.7 Safe Actionable Intelligence · LLM's PROPOSED
   * action. NEX decides whether to execute · this is a proposal only.
   * Every proposal is authorized through the schema → registry →
   * permission → guardrail → confirmation → execute → audit pipeline.
   */
  proposed_action?: {
    action_id: string;
    args?: Record<string, unknown>;
    rationale?: string;
  };
}

/**
 * A provider that turns a retrieval bundle into an LlmRescueOutput.
 * Streaming: AsyncIterable of partial tokens (for SSE) · plus a final
 * settled output via Promise. Non-streaming providers should still return
 * a single-token stream (yield full text, resolve output).
 */
export interface LlmRescueProvider {
  name: string;                       // e.g. "ollama:qwen2.5:3b"
  /**
   * Fire the LLM. Returns a stream (tokens) + a final settled output.
   * Both settle before the caller can conclude the reply.
   */
  invoke(input: {
    bundle: RetrievalBundle;
    budget_ms: number;                // Hard cap. Provider MUST abort on breach.
    signal?: AbortSignal;
  }): Promise<{
    tokens: AsyncIterable<string>;
    output: Promise<LlmRescueOutput>;
    provider_meta: {
      model: string;
      ttft_ms: number | null;         // real time-to-first-token
      total_ms: number | null;
      completed: boolean;             // false when budget breached
    };
  }>;
}

// ═══════════════════════════════════════════════════════════════════
// Truth-Engine-gated verdict · what the chat route actually consumes
// ═══════════════════════════════════════════════════════════════════

export interface RescueProviderMeta {
  model: string;
  ttft_ms: number | null;
  total_ms: number | null;
  completed: boolean;
}

export interface RescueVerdict {
  /** True → we produced a verified reply. False → honest "couldn't verify". */
  verified: boolean;
  reply_text: string;
  trust: TrustBand;                   // capped at evidence_provisional
  cited_source_refs: readonly string[];
  rejected_claims: readonly { text: string; reason: string }[];
  provider_meta: RescueProviderMeta;
  gap_created?: boolean;
  /**
   * Founder Path A · Phase A1 · Fabrication Gate v2.
   * Alignment score per kept claim. Score < NEX_GATE_ALIGNMENT_MIN
   * → claim was moved to rejected_claims with reason
   * postrationalisation_suspected:<score>. Kept claims all >= threshold.
   */
  alignment_scores?: readonly { source_ref: string; score: number; method: string }[];
  /** Aggregate min / mean / max over kept claims. Convenience for Observatory. */
  alignment_summary?: { min: number; mean: number; max: number; threshold: number };
}
