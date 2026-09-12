// src/lib/nex/live-chat-completion/retrieval/retrieval-router.ts
//
// Founder BEGIN Phase 3.2 · Three-level retrieval router.
//
// L1 · exact fingerprint          (nex.question_variant lookup by normalised text)
// L2 · structured intent + entity (existing parseIntent + hot-tier)
// L3 · semantic embeddings        (stub this BEGIN · returns null · pgvector in future BEGIN)
//
// The router tries L1 first (cheapest, sub-5ms warm), falls through to L2
// (existing pipeline, ~200ms cold, ~5ms warm), and would fall to L3 for
// genuinely novel wording.
//
// Every decision is recorded to nex.retrieval_hit for observability.

import type { Pool } from "pg";
import { performance } from "node:perf_hooks";
import { normaliseQuestion } from "@/lib/nex/live-chat-completion/question-factory/fingerprint";

export type RetrievalLevel = "L1_exact" | "L2_structured" | "L3_semantic" | "none";

export interface RetrievalHit {
  level: RetrievalLevel;
  matched: boolean;
  /** For L1 hits: the fingerprint that matched. */
  fingerprint?: string;
  /** For L1 hits: the resolved (entity_ref, intent_slug) from question_variant. */
  entity_ref?: string | null;
  intent_slug?: string | null;
  /** For L1 hits: the persisted trust + status of the question. */
  answer_status?: string | null;
  trust?: string | null;
  latency_ms: number;
}

export interface RetrievalRouterDeps {
  kfPool: Pool;
  /** Sample rate for nex.retrieval_hit inserts (0..1). Default 0.05. */
  observability_sample_rate?: number;
}

export function makeRetrievalRouter(deps: RetrievalRouterDeps) {
  const sample = typeof deps.observability_sample_rate === "number"
    ? Math.min(1, Math.max(0, deps.observability_sample_rate))
    : 0.05;

  return {
    /** L1 · exact fingerprint. Fast, deterministic, no NLP. */
    async l1Exact(input: {
      domain: string;
      message: string;
      language: "en" | "id";
      conversation_id?: string | null;
    }): Promise<RetrievalHit> {
      const t0 = performance.now();
      const normalised = normaliseQuestion(input.message);
      if (!normalised) {
        return { level: "L1_exact", matched: false, latency_ms: Math.round(performance.now() - t0) };
      }
      try {
        const res = await deps.kfPool.query(
          `SELECT fingerprint, entity_ref, intent_slug, answer_status, trust
             FROM nex.question_variant
             WHERE domain = $1 AND language = $2 AND normalised_text = $3
             ORDER BY
               CASE answer_status
                 WHEN 'answered' THEN 0
                 WHEN 'partially_answered' THEN 1
                 WHEN 'unknown' THEN 2
                 ELSE 3
               END,
               last_verified_at DESC NULLS LAST
             LIMIT 1`,
          [input.domain, input.language, normalised],
        );
        const ms = Math.round(performance.now() - t0);
        if (res.rowCount === 0) {
          const hit: RetrievalHit = { level: "L1_exact", matched: false, latency_ms: ms };
          if (Math.random() < sample) void recordHit(deps.kfPool, input.domain, input.conversation_id ?? null, hit);
          return hit;
        }
        const r = res.rows[0];
        const hit: RetrievalHit = {
          level: "L1_exact",
          matched: true,
          fingerprint: String(r.fingerprint),
          entity_ref: r.entity_ref ? String(r.entity_ref) : null,
          intent_slug: r.intent_slug ? String(r.intent_slug) : null,
          answer_status: r.answer_status ? String(r.answer_status) : null,
          trust: r.trust ? String(r.trust) : null,
          latency_ms: ms,
        };
        if (Math.random() < sample) void recordHit(deps.kfPool, input.domain, input.conversation_id ?? null, hit);
        return hit;
      } catch {
        return { level: "L1_exact", matched: false, latency_ms: Math.round(performance.now() - t0) };
      }
    },

    /**
     * L2 · structured intent + entity via the existing parseIntent + hot-tier.
     * This router does NOT run the parse itself — the adapter continues to
     * own that logic. The router only records that L2 was the level used
     * so observability shows the distribution.
     */
    recordL2(input: {
      domain: string;
      conversation_id?: string | null;
      intent_slug: string | null;
      entity_ref: string | null;
      matched: boolean;
      latency_ms: number;
    }): void {
      const hit: RetrievalHit = {
        level: "L2_structured",
        matched: input.matched,
        entity_ref: input.entity_ref,
        intent_slug: input.intent_slug,
        latency_ms: input.latency_ms,
      };
      if (Math.random() < sample) void recordHit(deps.kfPool, input.domain, input.conversation_id ?? null, hit);
    },

    /**
     * L3 · semantic embeddings. Stub this BEGIN · returns null.
     * Future BEGIN wires a local embedding model + pgvector over
     * nex.question_variant.normalised_text + entity_index.canonical_name.
     * When implemented, the composer should treat L3 hits as CANDIDATES
     * that require verification, not as authoritative answers.
     */
    async l3Semantic(_input: {
      domain: string;
      message: string;
      language: "en" | "id";
    }): Promise<RetrievalHit> {
      return { level: "L3_semantic", matched: false, latency_ms: 0 };
    },
  };
}

async function recordHit(pool: Pool, domain: string, conversation_id: string | null, hit: RetrievalHit): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO nex.retrieval_hit
         (domain, conversation_id, level, matched, intent_slug, entity_ref, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [domain, conversation_id, hit.level, hit.matched, hit.intent_slug ?? null, hit.entity_ref ?? null, hit.latency_ms],
    );
  } catch { /* observability failure must never break the reply */ }
}
