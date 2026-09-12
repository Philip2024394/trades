// src/lib/nex/live-chat-completion/knowledge-gap-queue.ts
//
// Founder BEGIN Phase 2 · KnowledgeGapQueue Postgres implementation.
//
// Idempotent enqueue keyed on (domain, entity_ref, intent_slug). Repeated
// enqueues increment times_seen and refresh last_seen_at without
// duplicating the row. Real user demand accumulates in times_seen.
//
// Two callers today:
//   1. Live chat adapter (source = "live_chat")     — real user asked something we couldn't answer.
//   2. Question verifier (source = "verifier")      — a candidate variant resolved to unknown.
//
// Also exposes pull() for gap-resolution workers (future BEGIN).

import type { Pool } from "pg";
import type { KnowledgeGapQueue, Domain } from "./contract";

export function makeKnowledgeGapQueue(deps: { kfPool: Pool }): KnowledgeGapQueue {
  const kf = deps.kfPool;
  return {
    async enqueue(input) {
      const res = await kf.query(
        `INSERT INTO nex.knowledge_gap
           (domain, entity_ref, intent_slug, source, source_conversation_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (domain, entity_ref, intent_slug) DO UPDATE SET
           times_seen = nex.knowledge_gap.times_seen + 1,
           last_seen_at = now()
         RETURNING gap_id::text AS gap_id, (xmax = 0) AS was_insert`,
        [input.domain, input.entity_ref, input.intent_slug, input.source, input.source_conversation_id ?? null],
      );
      const row = res.rows[0];
      return { gap_id: String(row.gap_id), created: Boolean(row.was_insert) };
    },
    async pull({ domain, limit }) {
      const params: unknown[] = domain ? [domain, limit] : [limit];
      const where = domain ? `WHERE resolved_at IS NULL AND domain = $1` : `WHERE resolved_at IS NULL`;
      const limClause = domain ? `LIMIT $2` : `LIMIT $1`;
      const q = `
        SELECT gap_id::text, domain, entity_ref, intent_slug, times_seen, first_seen_at
          FROM nex.knowledge_gap
          ${where}
          ORDER BY times_seen DESC, first_seen_at ASC
          ${limClause}
      `;
      const res = await kf.query(q, params);
      return res.rows.map((r) => ({
        gap_id: String(r.gap_id),
        domain: r.domain as Domain,
        entity_ref: String(r.entity_ref),
        intent_slug: String(r.intent_slug),
        times_seen: Number(r.times_seen),
        first_seen_at: r.first_seen_at instanceof Date ? r.first_seen_at.toISOString() : String(r.first_seen_at),
      }));
    },
    async resolve(input) {
      await kf.query(
        `UPDATE nex.knowledge_gap SET
           resolved_at = now(),
           resolved_by = $2,
           resolution_fact_ref = $3
         WHERE gap_id = $1::uuid AND resolved_at IS NULL`,
        [input.gap_id, input.resolved_by, input.resolution_fact_ref],
      );
    },
  };
}
