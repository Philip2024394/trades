// src/lib/nex-stories-brain/types.ts
//
// NEX1 · STORIES BRAIN · type definitions.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
// Stories Brain sits BEHIND the Truth/Evidence integration layer.
// Completely separate from Origin Canon. Semantic-only responses.

export type EvidenceTag =
  | "HISTORICALLY_ESTABLISHED"
  | "HISTORICALLY_SUPPORTED"
  | "ARCHAEOLOGICALLY_SUPPORTED"
  | "TRADITIONALLY_RECORDED"
  | "RELIGIOUS_TRADITION"
  | "MYTHOLOGICAL_TRADITION"
  | "ORAL_TRADITION"
  | "DISPUTED"
  | "UNRESOLVED"
  | "SPECULATIVE"
  | "MODERN_INTERPRETATION"
  | "CONTRADICTED_BY_EVIDENCE"
  | "UNKNOWN";

export interface EvidenceCategory {
  readonly id: EvidenceTag;
  readonly definition: string;
  readonly example: string;
}
export interface EvidenceTaxonomyDoc {
  readonly version: string;
  readonly notes: string;
  readonly categories: readonly EvidenceCategory[];
}

export interface SubClaim {
  readonly id: string;
  readonly claim: string;
  readonly evidence: EvidenceTag;
}

export interface Topic {
  readonly topic_id: string;
  readonly display_name: string;
  readonly domain: string;
  readonly aliases: readonly string[];
  readonly sub_claims: readonly SubClaim[];
  readonly layer_summary: string;
  readonly discussion_opener: string;
  readonly offer_to_expand: string;
  readonly never_says: readonly string[];
}
export interface TopicsDoc {
  readonly version: string;
  readonly notes: string;
  readonly topics: readonly Topic[];
}

/**
 * A stateless classification of a user's utterance into a story topic.
 * If no topic matches confidently, returns null-topic with an UNKNOWN
 * evidence tag so downstream layers can fail-closed or ask a clarifying
 * question. Never fabricates.
 */
export interface StoryClassification {
  readonly matched_topic_id: string | null;
  readonly matched_alias: string | null;
  readonly rationale: string;
  readonly consistency_fingerprint: string;   // hash of matched_topic_id + sub_claim_ids
}

export interface StoryResponsePlan {
  readonly matched_topic_id: string | null;
  readonly topic_recognition: string;
  readonly decomposition: readonly SubClaim[];
  readonly evidence_by_sub: Readonly<Record<string, EvidenceTag>>;
  readonly layer_summary: string;
  readonly discussion_opener: string;
  readonly offer_to_expand: string;
  readonly never_says: readonly string[];
  readonly evidence_pointers: readonly string[];   // SB-* rule ids + topic_id
  readonly consistency_fingerprint: string;
  readonly semantic_only: true;
  readonly taught_by: "master_ai_engineer";
}
