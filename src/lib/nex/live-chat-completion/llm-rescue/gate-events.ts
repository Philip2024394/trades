// src/lib/nex/live-chat-completion/llm-rescue/gate-events.ts
//
// Founder Path A · Phase C1 · Fabrication Gate event log writer.
//
// Best-effort · fire-and-forget writes to nex.gate_rejection_event and
// nex.gate_kept_event. Wrapped in try/catch so the gate NEVER fails on
// a DB error. Observability is layered · never load-bearing.
//
// Called from gate.ts after every claim decision.

import { randomUUID } from "node:crypto";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

const _writesEnabled = (() => {
  const v = process.env.NEX_GATE_EVENT_LOG;
  return v !== "off" && v !== "0" && v !== "false";
})();

export interface GateRejectionEvent {
  conversation_id?: string | null;
  provider_model?: string | null;
  reason: string;
  source_ref?: string | null;
  alignment_score?: number | null;
  alignment_threshold?: number | null;
  claim_text_preview?: string | null;
}

export interface GateKeptEvent {
  conversation_id?: string | null;
  provider_model?: string | null;
  source_ref?: string | null;
  alignment_score?: number | null;
  alignment_threshold?: number | null;
}

export function writeGateRejection(evt: GateRejectionEvent): void {
  if (!_writesEnabled) return;
  // Fire-and-forget · never awaited · never throws.
  void (async () => {
    try {
      const pool = getKnowledgeFactoryDbPool();
      await pool.query(
        `INSERT INTO nex.gate_rejection_event
          (event_id, conversation_id, provider_model, reason, source_ref,
           alignment_score, alignment_threshold, claim_text_preview)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          randomUUID(),
          evt.conversation_id ?? null,
          evt.provider_model ?? null,
          evt.reason,
          evt.source_ref ?? null,
          evt.alignment_score ?? null,
          evt.alignment_threshold ?? null,
          evt.claim_text_preview?.slice(0, 200) ?? null,
        ],
      );
    } catch { /* swallow · observability MUST NOT crash the gate */ }
  })();
}

export function writeGateKept(evt: GateKeptEvent): void {
  if (!_writesEnabled) return;
  void (async () => {
    try {
      const pool = getKnowledgeFactoryDbPool();
      await pool.query(
        `INSERT INTO nex.gate_kept_event
          (event_id, conversation_id, provider_model, source_ref,
           alignment_score, alignment_threshold)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(),
          evt.conversation_id ?? null,
          evt.provider_model ?? null,
          evt.source_ref ?? null,
          evt.alignment_score ?? null,
          evt.alignment_threshold ?? null,
        ],
      );
    } catch { /* swallow */ }
  })();
}
