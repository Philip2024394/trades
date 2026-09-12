// src/lib/nex/observatory-brain/turn-telemetry.ts
//
// Founder Path A · Phase OBS-2 · per-turn latency writer.
//
// Fire-and-forget · never awaited · never throws. Observability MUST
// NOT crash the chat route on a DB error.

import { randomUUID } from "node:crypto";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

const _writesEnabled = (() => {
  const v = process.env.NEX_TURN_TELEMETRY;
  return v !== "off" && v !== "0" && v !== "false";
})();

export type PromotionPath = "adapter" | "composer" | "rescue" | "research" | "none";

export interface TurnTelemetryEvent {
  conversation_id?: string | null;
  domain?: string | null;
  promotion_path: PromotionPath;
  llm_invoked: boolean;
  research_activated: boolean;
  total_ms: number;
  adapter_ms?: number | null;
  composer_ms?: number | null;
  rescue_ms?: number | null;
  research_ms?: number | null;
  vision_ms?: number | null;
  file_ms?: number | null;
  memory_ms?: number | null;
  gate_alignment_mean?: number | null;
  // Founder Phase 4 · P4-3 · cost columns.
  prompt_tokens?: number | null;
  response_tokens?: number | null;
  provider_cost_usd?: number | null;
}

export function writeTurnTelemetry(evt: TurnTelemetryEvent): void {
  if (!_writesEnabled) return;
  void (async () => {
    try {
      const pool = getKnowledgeFactoryDbPool();
      await pool.query(
        `INSERT INTO nex.turn_latency_event
          (event_id, conversation_id, domain, promotion_path, llm_invoked,
           research_activated, total_ms, adapter_ms, composer_ms, rescue_ms,
           research_ms, vision_ms, file_ms, memory_ms, gate_alignment_mean,
           prompt_tokens, response_tokens, provider_cost_usd)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                 $16, $17, $18)`,
        [
          randomUUID(),
          evt.conversation_id ?? null,
          evt.domain ?? null,
          evt.promotion_path,
          evt.llm_invoked,
          evt.research_activated,
          Math.max(0, Math.round(evt.total_ms)),
          evt.adapter_ms != null ? Math.max(0, Math.round(evt.adapter_ms)) : null,
          evt.composer_ms != null ? Math.max(0, Math.round(evt.composer_ms)) : null,
          evt.rescue_ms != null ? Math.max(0, Math.round(evt.rescue_ms)) : null,
          evt.research_ms != null ? Math.max(0, Math.round(evt.research_ms)) : null,
          evt.vision_ms != null ? Math.max(0, Math.round(evt.vision_ms)) : null,
          evt.file_ms != null ? Math.max(0, Math.round(evt.file_ms)) : null,
          evt.memory_ms != null ? Math.max(0, Math.round(evt.memory_ms)) : null,
          evt.gate_alignment_mean ?? null,
          evt.prompt_tokens != null ? Math.max(0, Math.round(evt.prompt_tokens)) : null,
          evt.response_tokens != null ? Math.max(0, Math.round(evt.response_tokens)) : null,
          evt.provider_cost_usd ?? null,
        ],
      );
    } catch { /* swallow */ }
  })();
}
