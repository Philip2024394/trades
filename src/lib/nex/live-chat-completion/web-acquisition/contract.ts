// src/lib/nex/live-chat-completion/web-acquisition/contract.ts
//
// Founder BEGIN Phase 3.5 · Web Acquisition contract.
//
// Founder rule (2026-09-09): LLM rescue must never bypass the Truth Engine.
// That rule extends to web acquisition: web results are EVIDENCE candidates,
// never authoritative answers. Every web claim flows through the same
// Fabrication Gate that rejects orphan citations.
//
// Ordering (founder's Phase 3.4A/B/C spec):
//   Exact → Structured → Semantic → Web Acquisition → LLM synthesis → Gate
//
// Web providers are zero-paid-API. First provider: DuckDuckGo Instant
// Answer + Wikipedia REST (both free, no key). Mock provider for
// regression testing. Future providers (paid) require Founder BEGIN.

import type { EvidenceItem } from "@/lib/nex/live-chat-completion/llm-rescue/contract";

/**
 * A single structured web-search result. Never contains full page HTML —
 * only extracted structured fields the LLM can cite.
 */
export interface WebResult {
  /** Short title of the result (from search engine metadata). */
  title: string;
  /** ≤ 500 chars extracted snippet · what the LLM may quote. */
  snippet: string;
  /** Canonical URL · used as source_reference for citation trace. */
  url: string;
  /** Search provider that returned this result. */
  provider: string;
  /** ISO timestamp of retrieval. */
  retrieved_at: string;
  /** Optional confidence hint from provider · 0..1 · defaults 0.5. */
  confidence?: number;
}

export interface WebAcquisitionInput {
  query: string;
  budget_ms: number;
  signal?: AbortSignal;
  language?: "en" | "id";
  /** Optional focus entity name for provider hints. */
  entity_name?: string | null;
}

export interface WebAcquisitionOutput {
  results: readonly WebResult[];
  provider_meta: {
    provider: string;
    request_ms: number;
    completed: boolean;
    result_count: number;
    error?: string;
  };
}

export interface WebProvider {
  name: string;
  acquire(input: WebAcquisitionInput): Promise<WebAcquisitionOutput>;
}

/**
 * Convert a WebResult into an EvidenceItem so the same LLM rescue
 * pipeline can consume it uniformly with fact/provenance/question_variant
 * evidence. ref_id is deterministic from the URL so citations survive
 * across turns.
 */
export function webResultToEvidence(result: WebResult): EvidenceItem {
  // Deterministic short id from URL · avoids source_ref explosion.
  const urlHash = simpleHash(result.url);
  return {
    ref_id: `web:${urlHash}`,
    source_type: "web_search",
    entity_ref: null,
    intent_slug: null,
    text: `${result.title} · ${result.snippet}`,
    confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
    verified_at: result.retrieved_at,
    source_reference: result.url,
  };
}

function simpleHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return (h >>> 0).toString(36);
}
