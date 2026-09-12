// src/lib/nex/observatory-brain/retrieval-telemetry.ts
//
// Founder Phase 4 · P4-2 · per-retrieval telemetry writer.
//
// Fire-and-forget · never awaited · never throws. Observability MUST
// NOT crash the retrieval path on a DB error.

import { randomUUID } from "node:crypto";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

const _writesEnabled = (() => {
  const v = process.env.NEX_RETRIEVAL_TELEMETRY;
  return v !== "off" && v !== "0" && v !== "false";
})();

export type RetrieverPath =
  | "kb_hybrid"        // Knowledge Brain hybrid retriever (BM25 + dense + rerank)
  | "web_composite"    // Web composite provider (DDG + Wikipedia + Wikidata + …)
  | "research_brain"   // Research Brain per-step search
  | "vision"           // Vision extraction
  | "file"             // File extraction
  | "memory";          // Memory recall (not evidence · Doctrine #4 · logged for surface)

export interface RetrievalTelemetryEvent {
  conversation_id?: string | null;
  retriever_path: RetrieverPath;
  domain?: string | null;
  query_length_chars?: number | null;
  hit_count: number;
  top_hit_similarity?: number | null;
  latency_ms: number;
  error?: string | null;
  sub_provider_meta?: Record<string, unknown> | null;
}

export function writeRetrievalEvent(evt: RetrievalTelemetryEvent): void {
  if (!_writesEnabled) return;
  void (async () => {
    try {
      const pool = getKnowledgeFactoryDbPool();
      await pool.query(
        `INSERT INTO nex.retrieval_event
          (event_id, conversation_id, retriever_path, domain, query_length_chars,
           hit_count, top_hit_similarity, latency_ms, error, sub_provider_meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
        [
          randomUUID(),
          evt.conversation_id ?? null,
          evt.retriever_path,
          evt.domain ?? null,
          evt.query_length_chars ?? null,
          Math.max(0, Math.round(evt.hit_count)),
          evt.top_hit_similarity ?? null,
          Math.max(0, Math.round(evt.latency_ms)),
          evt.error ?? null,
          JSON.stringify(evt.sub_provider_meta ?? {}),
        ],
      );
    } catch { /* swallow · observability never crashes retrieval */ }
  })();
}
