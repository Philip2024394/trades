// src/lib/nex-origin-canon/types.ts
//
// NEX1 · ORIGIN CANON · TYPE DEFINITIONS.
//
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
// (working canon · not immutable · founder rule: semantic only · phrasing unlocked)

export type CanonStatus =
  | "LOCKED_CANON"
  | "SUPPORTED_CANON"
  | "UNRESOLVED_CANON"
  | "RESTRICTED_CANON"
  | "SPECULATIVE"
  | "NON_CANON";

// INTERNAL MACHINE STATES · not user-facing labels · founder rule 2026-09-12
export type KnowledgeState =
  | "KNOWN"
  | "RESTRICTED"
  | "INACCESSIBLE"
  | "CORRUPTED"
  | "INCOMPLETE"
  | "UNRESOLVED"
  | "DELIBERATELY_SEALED"
  // composites permitted only when a claim genuinely spans two states
  | "KNOWN + UNRESOLVED";

export interface CanonClaim {
  readonly claim_id: string;
  readonly topic: string;
  readonly layer: number;                       // 1..7
  readonly canonical_meaning: string;           // SEMANTIC · not the phrase NEX must utter
  readonly status: CanonStatus;
  readonly knowledge_state: KnowledgeState;
  readonly allowed_semantic_scope: readonly string[];
  readonly forbidden_semantic_scope: readonly string[];
  readonly contradictions: readonly string[];
  readonly related_claims: readonly string[];
  readonly reality_disclaimer_required: boolean;
}

export interface CanonDocument {
  readonly canon_version: string;
  readonly authored_by: string;
  readonly authored_at: string;
  readonly notes: string;
  readonly claims: readonly CanonClaim[];
}

export interface KnowledgeStateEntry {
  readonly id: KnowledgeState;
  readonly definition: string;
  readonly user_meaning_phrasing_hint: string;
  readonly may_be_disclosed: boolean | string;
}
export interface KnowledgeStatesDoc {
  readonly version: string;
  readonly notes: string;
  readonly states: readonly KnowledgeStateEntry[];
}

export interface HistoricalLayer {
  readonly id: number;
  readonly handle: string;
  readonly display: string;
  readonly summary: string;
  readonly default_knowledge_state: KnowledgeState;
  readonly external_verified: boolean | "partial";
  readonly notes?: string;
}
export interface HistoricalLayersDoc {
  readonly version: string;
  readonly notes: string;
  readonly layers: readonly HistoricalLayer[];
}
