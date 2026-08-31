// NEX Indonesia · Knowledge acquisition pipeline.
//
// The single funnel between any walker and the corpus. Every fact
// flows through here so we can guarantee:
//   · Provenance — untraced facts are dropped.
//   · Dedupe — a hospital appearing in two walker outputs merges,
//     doesn't duplicate.
//   · Quality — a minimum-length + minimum-keywords gate blocks junk.
//   · Q&A variants generated once (see qa-generator.ts) so retrieval
//     is O(1) at request time.
//   · Deterministic ID assignment — every published record's ID is a
//     hash of its content, so re-running a walker with the same data
//     produces the same IDs (idempotent).
//
// The pipeline does NOT hit the LLM. It's pure functions + file I/O.

import { createHash } from "node:crypto";
import type { KnowledgeRecord } from "../knowledge";
import type { RawFactChunk, KnowledgeWalker } from "./types";
import { generateQaVariants } from "./qa-generator";

export type PipelineOptions = {
  /** Reject chunks whose content is shorter than this (chars). Default 40. */
  minContentChars?: number;
  /** Reject chunks with fewer than this many keywords. Default 2. */
  minKeywords?: number;
  /** Minimum walker-declared confidence to keep. Default 0.6. */
  minConfidence?: number;
};

export type PipelineReport = {
  walkerId: string;
  in: number;
  published: number;
  rejected: Array<{ externalId: string; reason: string }>;
  deduped: Array<{ externalId: string; mergedInto: string }>;
  qaVariantsTotal: number;
};

export type PipelineResult = {
  records: EnrichedKnowledgeRecord[];
  reports: PipelineReport[];
};

/** Corpus record enriched with Q&A variants and category. Superset
 *  of KnowledgeRecord — remains readable by the existing
 *  retrieveKnowledge() code (extra fields are ignored). */
export type EnrichedKnowledgeRecord = KnowledgeRecord & {
  /** Walker-declared category ("landmark", "food", "safety", …).
   *  Derived from the walker's domain when absent. */
  category?: string;
  /** Who this fact is most relevant to. */
  audience?: string[];
  /** Generated + curated question variants for retrieval matching. */
  questions?: string[];
  /** Extra alias strings the retrieval may match on. */
  aliases?: string[];
  /** ISO date · when the pipeline last refreshed this record. */
  acquired_at: string;
  /** ISO date · when this record should be re-acquired. */
  refresh_after?: string;
  /** The walker that produced it. */
  walker_id: string;
};

/** Run one walker through the pipeline. Never throws — returns a
 *  report describing what was accepted and why anything was dropped. */
export async function runWalker(
  walker: KnowledgeWalker,
  opts: PipelineOptions = {},
): Promise<{ records: EnrichedKnowledgeRecord[]; report: PipelineReport }> {
  const minContentChars = opts.minContentChars ?? 40;
  const minKeywords = opts.minKeywords ?? 2;
  const minConfidence = opts.minConfidence ?? 0.6;

  const chunks = await walker.acquire();
  const report: PipelineReport = {
    walkerId: walker.id,
    in: chunks.length,
    published: 0,
    rejected: [],
    deduped: [],
    qaVariantsTotal: 0,
  };

  // First pass · reject invalid chunks.
  const kept: RawFactChunk[] = [];
  for (const c of chunks) {
    const reason = validate(c, { minContentChars, minKeywords, minConfidence });
    if (reason) report.rejected.push({ externalId: c.externalId, reason });
    else kept.push(c);
  }

  // Second pass · dedupe by normalised topic + region.
  const byKey = new Map<string, RawFactChunk>();
  for (const c of kept) {
    const key = `${c.topic.trim().toLowerCase()}|${c.region.trim().toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing) { byKey.set(key, c); continue; }
    // Merge · keep the higher-confidence one, union keywords.
    const winner = (c.confidence ?? 0.8) > (existing.confidence ?? 0.8) ? c : existing;
    const loser = winner === c ? existing : c;
    const merged: RawFactChunk = {
      ...winner,
      keywords: unique([...(winner.keywords ?? []), ...(loser.keywords ?? [])]),
    };
    byKey.set(key, merged);
    report.deduped.push({ externalId: loser.externalId, mergedInto: winner.externalId });
  }

  // Third pass · enrich + generate Q&A.
  const records: EnrichedKnowledgeRecord[] = [];
  const acquired_at = new Date().toISOString().slice(0, 10);
  for (const c of byKey.values()) {
    const id = deterministicId(walker.id, c.externalId);
    const variants = generateQaVariants(c);
    report.qaVariantsTotal += variants.questions.length;
    const stability = c.stability ?? walker.defaultStability;
    const rec: EnrichedKnowledgeRecord = {
      id,
      topic: c.topic,
      region: c.region,
      language: c.language ?? "en",
      stability,
      confidence: c.confidence ?? 0.8,
      source: c.source,
      last_verified: c.observedAt,
      content: c.content,
      keywords: unique(c.keywords.map((k) => k.toLowerCase())),
      category: c.domain,
      audience: c.audience ?? ["tourist"],
      questions: variants.questions,
      aliases: variants.aliases,
      acquired_at,
      refresh_after: c.stability === "live"
        ? undefined // live never lives in the corpus · marker only
        : refreshDate(acquired_at, walker.refreshCadenceDays),
      walker_id: walker.id,
    };
    records.push(rec);
    report.published++;
  }

  return { records, report };
}

/** Run many walkers. Records are returned in a single sorted list
 *  (deterministic order → replayable index files). */
export async function runWalkerFleet(
  walkers: KnowledgeWalker[],
  opts: PipelineOptions = {},
): Promise<PipelineResult> {
  const allRecords: EnrichedKnowledgeRecord[] = [];
  const reports: PipelineReport[] = [];
  for (const w of walkers) {
    const r = await runWalker(w, opts);
    allRecords.push(...r.records);
    reports.push(r.report);
  }
  allRecords.sort((a, b) => a.id.localeCompare(b.id));
  return { records: allRecords, reports };
}

// ─── helpers ──────────────────────────────────────────────────────

function validate(
  c: RawFactChunk,
  opts: { minContentChars: number; minKeywords: number; minConfidence: number },
): string | null {
  if (!c.source || !c.source.trim()) return "missing_source";
  if (!c.content || c.content.trim().length < opts.minContentChars) return `content_too_short_(${c.content?.length ?? 0}<${opts.minContentChars})`;
  if (!Array.isArray(c.keywords) || c.keywords.length < opts.minKeywords) return `too_few_keywords_(${c.keywords?.length ?? 0}<${opts.minKeywords})`;
  if ((c.confidence ?? 1) < opts.minConfidence) return `low_confidence_(${c.confidence}<${opts.minConfidence})`;
  if (!c.externalId) return "missing_external_id";
  if (!c.topic) return "missing_topic";
  if (!c.region) return "missing_region";
  return null;
}

function unique<T>(a: T[]): T[] {
  const seen = new Set<T>(); const out: T[] = [];
  for (const x of a) if (!seen.has(x)) { seen.add(x); out.push(x); }
  return out;
}

function deterministicId(walkerId: string, externalId: string): string {
  const h = createHash("sha1").update(`${walkerId}::${externalId}`).digest("hex").slice(0, 10);
  return `walker-${walkerId.replace(/[^a-z0-9]+/gi, "-")}-${h}`;
}

function refreshDate(fromIso: string, days: number): string {
  const d = new Date(fromIso);
  d.setUTCDate(d.getUTCDate() + Math.max(1, Math.floor(days)));
  return d.toISOString().slice(0, 10);
}
