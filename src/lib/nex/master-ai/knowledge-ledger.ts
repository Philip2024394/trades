// src/lib/nex/master-ai/knowledge-ledger.ts
//
// NEX Master AI Engineer · M4 · Cross-agent knowledge ledger
// Philip 2026-09-07 · AUTHORIZE
//
// Append-only JSONL ledger that reuses Phase A discipline (immutable ·
// authority-tier · supersede-not-overwrite). New Master-AI-specific
// record categories per doctrine.
//
// PRESERVATION:
//   · Does NOT replace src/lib/nex/programmer-learning/store.ts. That
//     Phase A store remains the Programmer's own local ledger.
//   · Master AI's ledger lives at data/master-ai/knowledge_ledger.jsonl.
//   · Records here may cross-reference Phase A records via `source_ref`
//     but Master AI never mutates Phase A files.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { knowledgeLedgerPath } from "./paths";
import type {
  KnowledgeRecord,
  KnowledgeRecordCategory,
  MasterAgentId,
  AuthorityTier,
} from "./types";

export function recordKnowledge(input: {
  category: KnowledgeRecordCategory;
  agent_id: MasterAgentId | null;
  authority_tier: AuthorityTier;
  content: Record<string, unknown>;
  supersedes: string | null;
  provenance: { source: string; source_ref: string | null };
  created_by: string;
}): KnowledgeRecord {
  const record: KnowledgeRecord = {
    ...input,
    record_id: randomUUID(),
    created_at_iso: new Date().toISOString(),
  };
  appendJsonLine(knowledgeLedgerPath(), record);
  return record;
}

export function readAllKnowledge(): KnowledgeRecord[] {
  return readJsonlAll<KnowledgeRecord>(knowledgeLedgerPath());
}

/** Return latest record per (category, agent_id, content.slug-or-hash).
 *  Superseded entries excluded. */
export function listCurrentKnowledge(filter?: {
  category?: KnowledgeRecordCategory;
  agent_id?: MasterAgentId | null;
}): KnowledgeRecord[] {
  const all = readAllKnowledge();
  const supersededIds = new Set<string>();
  for (const r of all) if (r.supersedes) supersededIds.add(r.supersedes);
  return all
    .filter((r) => !supersededIds.has(r.record_id))
    .filter((r) => !filter?.category || r.category === filter.category)
    .filter((r) => filter?.agent_id === undefined || r.agent_id === filter.agent_id);
}

export function _resetKnowledgeLedgerForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(knowledgeLedgerPath())) fs.unlinkSync(knowledgeLedgerPath()); } catch { /* ignore */ }
}
