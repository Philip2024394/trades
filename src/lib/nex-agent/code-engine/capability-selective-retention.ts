// src/lib/nex-agent/code-engine/capability-selective-retention.ts
//
// NEX · Selective Retention + Retained-Knowledge Store · S7 · 2026-09-21.
// Founder-authorised as part of the "Internet as External Knowledge
// Substrate" programme.
//
// PURPOSE
//
//   Deterministic gate that decides whether a piece of CURRENT_EVIDENCE
//   is promoted to NEX_RETAINED. By default the answer is NO. Retention
//   is a positive act, not a passive accumulation:
//
//     - Retention requires at least one POSITIVE_RETENTION_SIGNAL AND
//       zero BLOCKING_RETENTION_SIGNALS (fail-closed).
//     - Every retained item is stamped with provenance: source,
//       retrieved_at, url_or_query, reliability_tier, evaluation_verdict,
//       AND retention_reason. Nothing lands in the store anonymously.
//     - The store is thin: JSONL append-only in the NEX data root,
//       inspectable, deletable, greppable.
//
//   This module gives the "retained knowledge" corner of the knowledge
//   diamond real code, without turning NEX into a warehouse.
//
// ANTI-CHEATING GUARANTEE
//
//   · No LLM. No inference. Signal matching is boolean.
//   · Retention is FAIL-CLOSED: any single blocking signal wins.
//   · The store is inspectable · every row can be read as JSON · the
//     reader can always answer "why did NEX keep this?"
//   · retention decisions emit a trace line consumed by the
//     regression audit.

import fs from "node:fs";
import path from "node:path";
import {
  BLOCKING_RETENTION_SIGNALS,
  POSITIVE_RETENTION_SIGNALS,
  type RetentionSignal,
} from "./capability-retention-model";

// ── Inputs ────────────────────────────────────────────────────────────

export interface SelectiveRetentionInputs {
  readonly source_identifier: string;
  readonly retrieved_at_iso: string;
  readonly url_or_query: string;
  readonly reliability_tier: "authoritative" | "established" | "unknown";
  readonly evaluation_verdict: string; // e.g. "AGREE", "confirmed", "own_record"
  readonly signals: readonly RetentionSignal[];
  readonly fact: unknown; // the retained payload · shape defined by the caller
}

export interface SelectiveRetentionDecision {
  readonly retain: boolean;
  readonly reason: string;
  readonly matched_positive_signals: readonly RetentionSignal[];
  readonly matched_blocking_signals: readonly RetentionSignal[];
}

const POSITIVE = new Set<RetentionSignal>(POSITIVE_RETENTION_SIGNALS);
const BLOCKING = new Set<RetentionSignal>(BLOCKING_RETENTION_SIGNALS);

// ── Decision function ────────────────────────────────────────────────

export function decideSelectiveRetention(inputs: SelectiveRetentionInputs): SelectiveRetentionDecision {
  const matchedPos: RetentionSignal[] = [];
  const matchedBlock: RetentionSignal[] = [];
  for (const s of inputs.signals) {
    if (POSITIVE.has(s)) matchedPos.push(s);
    else if (BLOCKING.has(s)) matchedBlock.push(s);
  }
  if (matchedBlock.length > 0) {
    return {
      retain: false,
      reason: `retention refused · blocking signal(s): ${matchedBlock.join(",")} · fail-closed`,
      matched_positive_signals: matchedPos,
      matched_blocking_signals: matchedBlock,
    };
  }
  if (matchedPos.length === 0) {
    return {
      retain: false,
      reason: "retention refused · no positive signal fired · default is transient_only",
      matched_positive_signals: [],
      matched_blocking_signals: [],
    };
  }
  return {
    retain: true,
    reason: `retained · positive signal(s): ${matchedPos.join(",")} · reliability=${inputs.reliability_tier} · verdict=${inputs.evaluation_verdict}`,
    matched_positive_signals: matchedPos,
    matched_blocking_signals: [],
  };
}

// ── Thin retained-knowledge store ────────────────────────────────────
//
// JSONL append-only. One row per retained item. Every row carries the
// full provenance envelope required by the RETRIEVAL_LIFECYCLE_TABLE
// NEX_RETAINED stage.

export interface RetainedKnowledgeRow {
  readonly id: string;
  readonly retained_at_iso: string;
  readonly source_identifier: string;
  readonly retrieved_at_iso: string;
  readonly url_or_query: string;
  readonly reliability_tier: "authoritative" | "established" | "unknown";
  readonly evaluation_verdict: string;
  readonly retention_reason: string;
  readonly matched_positive_signals: readonly RetentionSignal[];
  readonly info_class: string | null;
  readonly fact: unknown;
}

const STORE_DIR = path.resolve(process.cwd(), "data", "nex-retained-knowledge");
const STORE_FILE = path.join(STORE_DIR, "retained-knowledge.jsonl");

function ensureStoreDir(): void {
  try { fs.mkdirSync(STORE_DIR, { recursive: true }); } catch { /* silent · fs contract */ }
}

/** Retain the fact if the decision was retain=true. Returns the row
 *  written, or null if not retained. Never throws · store failure is
 *  logged silently but must not poison a chat turn. */
export function retainKnowledge(args: {
  readonly decision: SelectiveRetentionDecision;
  readonly inputs: SelectiveRetentionInputs;
  readonly info_class?: string | null;
}): RetainedKnowledgeRow | null {
  if (!args.decision.retain) return null;
  ensureStoreDir();
  const row: RetainedKnowledgeRow = {
    id: `ret-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    retained_at_iso: new Date().toISOString(),
    source_identifier: args.inputs.source_identifier,
    retrieved_at_iso: args.inputs.retrieved_at_iso,
    url_or_query: args.inputs.url_or_query,
    reliability_tier: args.inputs.reliability_tier,
    evaluation_verdict: args.inputs.evaluation_verdict,
    retention_reason: args.decision.reason,
    matched_positive_signals: args.decision.matched_positive_signals,
    info_class: args.info_class ?? null,
    fact: args.inputs.fact,
  };
  try {
    fs.appendFileSync(STORE_FILE, JSON.stringify(row) + "\n", "utf8");
  } catch { /* silent · never poison a turn */ }
  return row;
}

/** Read the store into memory. Used only by tests / audit / recall.
 *  Guaranteed to not throw · returns [] on any error. */
export function readRetainedKnowledge(): readonly RetainedKnowledgeRow[] {
  try {
    if (!fs.existsSync(STORE_FILE)) return [];
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const rows: RetainedKnowledgeRow[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try { rows.push(JSON.parse(trimmed) as RetainedKnowledgeRow); } catch { /* skip malformed */ }
    }
    return rows;
  } catch {
    return [];
  }
}

/** Test / audit hook · not used by chat turns. */
export function resetRetainedKnowledgeStoreForTests(): void {
  try { fs.rmSync(STORE_FILE, { force: true }); } catch { /* silent */ }
}

// ── Trace emitter ────────────────────────────────────────────────────

export function emitRetentionTrace(decision: SelectiveRetentionDecision, source: string): string {
  const tag = decision.retain ? "retained" : "not_retained";
  return `selective_retention · ${tag} · source=${source} · reason=${decision.reason.slice(0, 160)}`;
}
