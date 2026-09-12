// src/lib/nex/language/types.ts
//
// Founder BEGIN 2026-09-10 · shared types for the domain-agnostic language engine.
// Same shape used by every domain (code, business, brains). No LLM · deterministic.

export interface NormaliserResult {
  raw: string;
  cleaned: string;
  tokens: readonly string[];
  canonical_tokens: readonly string[];
  substitutions: readonly { from: string; to: string }[];
  unresolved: readonly string[];
  contained_question_mark: boolean;
}

export type DomainKey = "code" | "business" | "brain";

export interface DomainIntent {
  slug: string;
  display: string;
  domain: DomainKey;
  trigger_tokens: readonly string[];
  trigger_phrases?: readonly string[];
  clarify_questions: readonly string[];
  reply_template: string;
  confidence_base: number;
}

export interface IntentResolution {
  domain: DomainKey | null;
  intent_slug: string | null;
  confidence: number;
  trigger_matches: readonly string[];
  candidate_intents: readonly { slug: string; score: number }[];
  raw_normalisation: NormaliserResult;
}
