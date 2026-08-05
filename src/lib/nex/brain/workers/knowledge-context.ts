// NEX Brain · Knowledge Context Worker
//
// Philip 2026-08-06 · "NEX writes with memory, not in isolation."
//
// The Context Worker is the specialist that stops NEX from re-authoring
// what she already knows. Its ONE job:
//
//   Receive the new topic.
//   Search NEX's knowledge graph.
//   Gather the 5-10 most relevant records.
//   Hand those to the Knowledge Extractor.
//
// It runs BEFORE the Extractor. Every new inbox item now flows:
//
//   inbox_item
//        │
//        ▼
//   knowledge-context      ← THIS worker · retrieves related records
//        │
//        ▼
//   knowledge-extractor    ← writes NEW records + typed edges to the
//        │                   retrieved records instead of re-authoring
//        ▼
//   quality-checker        ← constitutional gate
//
// v1: keyword-based scoring (no embeddings). Every existing record is
// scored by keyword overlap on title, summary, concepts, and body.
// v2 (Supabase phase): pgvector cosine similarity against embedding
// column. Same interface — swap the scoring function.
//
// The Context Worker never authors records. It never modifies records.
// It only produces a context_bundle and enqueues the extractor job.

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { brainStore, nowIso } from "../storage";
import type {
  KnowledgeRecord,
  KnowledgeSource,
  WorkerJob,
  WorkerResult,
} from "../types";

const WORKER_ID = `knowledge-context@${process.pid}`;
const INBOX_ROOT = path.join(process.cwd(), "data", "knowledge-inbox");

// How many records to return in the context bundle. Enough to
// meaningfully inform the Extractor without blowing the prompt token
// budget. Groq Llama 3.3 70B handles ~8K token contexts comfortably.
const CONTEXT_BUNDLE_SIZE = 10;

// The shape the Extractor consumes.
export type ContextRecord = {
  record_id: string;
  title: string;
  category: string;
  summary: string;
  score: number;
  nex_concepts: string[];
  industry_concepts: string[];
  primary_audience: string;
  status: string;
  sample_edges: Array<{ edge_type: string; to: string }>;
};

export type ContextBundle = {
  inbox_item_id: string;
  input_source: KnowledgeSource;
  input_title: string;
  input_char_count: number;
  keywords: string[];
  records: ContextRecord[];
  gaps: string[]; // keywords with no matching record — these are candidates for new records
  method: "keyword-v1" | "pgvector-v2";
};

// ── Main entry ───────────────────────────────────────────────────────

export async function runKnowledgeContext(options: {
  lease_seconds?: number;
} = {}): Promise<{ job: WorkerJob | null; result?: WorkerResult; bundle?: ContextBundle }> {
  const store = brainStore();
  const job = await store.claimNextJob("knowledge-context", WORKER_ID, options.lease_seconds ?? 45);
  if (!job) return { job: null };

  try {
    const inboxItemId = job.input_ref;
    const source = (job.input_payload?.source as KnowledgeSource | undefined) ?? "raw-research";
    const title = String(job.input_payload?.title ?? "untitled");
    const contentPath = job.input_payload?.contentPath as string | undefined;
    const inlineContent = job.input_payload?.content as string | undefined;
    const url = job.input_payload?.url as string | undefined;

    // Load the raw content
    let content = inlineContent ?? "";
    if (!content && contentPath) {
      try {
        content = await fs.readFile(path.join(INBOX_ROOT, contentPath), "utf8");
      } catch {
        // Fall through — we'll still keyword-search on title alone
      }
    }
    if (!content && url) content = url;

    // Extract keywords from title + content
    const keywords = extractKeywords(`${title}\n${content}`.slice(0, 60_000));

    // Score every existing record against these keywords
    const allRecords = await store.listRecords({ limit: 5000 });
    const scored = scoreRecords(keywords, allRecords);

    // Top N
    const topRecords = scored.slice(0, CONTEXT_BUNDLE_SIZE);

    // Materialise the ContextBundle
    const contextRecords: ContextRecord[] = [];
    for (const { record, score } of topRecords) {
      const edges = await store.listEdges(record.record_id);
      const sampleEdges = edges.slice(0, 5).map((e) => ({
        edge_type: e.edge_type,
        to: e.to_record_id,
      }));
      contextRecords.push({
        record_id: record.record_id,
        title: record.title,
        category: record.category,
        summary: record.summary,
        score,
        nex_concepts: record.nex_concepts ?? [],
        industry_concepts: record.industry_concepts ?? [],
        primary_audience: record.primary_audience,
        status: record.status,
        sample_edges: sampleEdges,
      });
    }

    // Identify gaps: keywords that produced no meaningful match
    const gapKeywords = identifyGaps(keywords, scored);

    const bundle: ContextBundle = {
      inbox_item_id: inboxItemId,
      input_source: source,
      input_title: title,
      input_char_count: content.length,
      keywords: keywords.slice(0, 40),
      records: contextRecords,
      gaps: gapKeywords.slice(0, 20),
      method: "keyword-v1",
    };

    // Log the result
    const result = await store.insertResult({
      job_id: job.id,
      worker_type: "knowledge-context",
      worker_id: WORKER_ID,
      output_kind: "context_bundle",
      output_payload: bundle as unknown as Record<string, unknown>,
      overall_confidence: contextRecords.length > 0 ? Math.min(1, contextRecords[0].score / 10) : 0,
      llm_provider: "no-llm",
      llm_model: null,
      llm_tokens_in: null,
      llm_tokens_out: null,
      llm_ms: null,
      flags: contextRecords.length === 0 ? ["no-related-records-found"] : [],
    });

    // Enqueue the Voice Context job with the bundle attached.
    // Voice Context will assemble the brand/voice guide, then enqueue
    // the Extractor with BOTH bundles.
    await store.enqueueJob({
      worker_type: "voice-context",
      priority: sourcePriority(source),
      input_kind: "inbox_item",
      input_ref: inboxItemId,
      input_payload: {
        source,
        title,
        contentPath: contentPath ?? null,
        content: inlineContent ?? null,
        url: url ?? null,
        context_bundle: bundle,
      },
    });

    await store.insertAudit({
      entity_type: "worker_jobs",
      entity_id: inboxItemId,
      action: "context-assembled",
      actor: WORKER_ID,
      before_state: null,
      after_state: {
        keywords_found: keywords.length,
        related_records_returned: contextRecords.length,
        gap_keywords: gapKeywords.length,
      },
      notes: `Context bundle produced with ${contextRecords.length} related record(s); ${gapKeywords.length} gap keyword(s) surfaced`,
    });

    await store.completeJob(job.id, result.id);
    return { job, result, bundle };
  } catch (err) {
    const message = (err as Error).message;
    console.error("[knowledge-context] failed:", message);
    await store.failJob(job.id, message);
    return { job };
  }
}

// ── Keyword extraction ──────────────────────────────────────────────

// Domain-aware stopword list for staircase/kitchen/timber content.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "for", "of", "in", "on", "at",
  "to", "with", "by", "from", "as", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "must", "this", "that", "these",
  "those", "i", "you", "he", "she", "it", "we", "they", "what", "which", "who",
  "when", "where", "why", "how", "all", "each", "every", "both", "few", "more",
  "most", "other", "some", "such", "no", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "any", "up", "down", "out", "off", "over",
  "under", "into", "through", "about", "into", "onto", "your", "his", "her",
  "its", "their", "there", "here", "then", "also", "yes", "no",
]);

function extractKeywords(text: string): string[] {
  // Normalise → tokens → drop stopwords → keep meaningful words
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && w.length <= 30 && !STOPWORDS.has(w) && !/^\d+$/.test(w));

  // Frequency count
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);

  // Also add 2-grams for known compound terms (walnut treads, closed string, etc.)
  const words = tokens.filter((w) => !STOPWORDS.has(w));
  for (let i = 0; i < words.length - 1; i += 1) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (bigram.length > 6 && bigram.length < 40) {
      freq.set(bigram, (freq.get(bigram) ?? 0) + 1);
    }
  }

  // Sort by frequency, keep meaningful ones
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .filter(([_, count]) => count >= 1)
    .map(([w]) => w)
    .slice(0, 80);
}

// ── Record scoring ──────────────────────────────────────────────────

type ScoredRecord = { record: KnowledgeRecord; score: number; matches: string[] };

function scoreRecords(keywords: string[], records: KnowledgeRecord[]): ScoredRecord[] {
  const kwSet = new Set(keywords);
  const scored: ScoredRecord[] = [];

  for (const rec of records) {
    // Only surface AUTHORITATIVE + UNDER_REVIEW records — drafts and
    // deprecated ones aren't reliable context.
    if (rec.status === "DRAFT" || rec.status === "DEPRECATED" || rec.status === "SUPERSEDED") continue;

    let score = 0;
    const matches: string[] = [];

    const titleLower = rec.title.toLowerCase();
    const summaryLower = (rec.summary ?? "").toLowerCase();
    const bodyLower = (rec.body_markdown ?? "").toLowerCase();
    const conceptStrings = [
      ...(rec.industry_concepts ?? []),
      ...(rec.nex_concepts ?? []),
    ]
      .join(" ")
      .toLowerCase();

    for (const kw of kwSet) {
      // Title match — highest weight
      if (titleLower.includes(kw)) {
        score += 8;
        matches.push(`title:${kw}`);
      }
      // Concepts match — the semantic backbone
      if (conceptStrings.includes(kw)) {
        score += 5;
        matches.push(`concepts:${kw}`);
      }
      // Summary match — high signal
      if (summaryLower.includes(kw)) {
        score += 3;
        matches.push(`summary:${kw}`);
      }
      // Body match — lower per-match to prevent long bodies dominating
      if (bodyLower.includes(kw)) {
        score += 1;
        matches.push(`body:${kw}`);
      }
    }

    if (score > 0) scored.push({ record: rec, score, matches });
  }

  // Sort by score desc
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// ── Gap detection ───────────────────────────────────────────────────

// Which keywords produced no meaningful match anywhere in the corpus?
// These are candidates for new records — the Extractor should focus
// its authoring on filling these gaps rather than re-authoring what
// the retrieved records already cover.
function identifyGaps(keywords: string[], scored: ScoredRecord[]): string[] {
  const usedKeywords = new Set<string>();
  for (const { matches } of scored.slice(0, 20)) {
    for (const m of matches) {
      const kw = m.split(":")[1];
      if (kw) usedKeywords.add(kw);
    }
  }
  return keywords.filter((k) => !usedKeywords.has(k));
}

// ── Priority mapping (mirrors manager.ts) ───────────────────────────

function sourcePriority(source: KnowledgeSource): number {
  switch (source) {
    case "gov-standards":      return 1;
    case "chatgpt-approved":   return 2;
    case "claude-generated":   return 2;
    case "customer-qa":        return 3;
    case "raw-research":       return 4;
    case "internet-article":   return 5;
    case "personal-ideas":     return 6;
    case "needs-verification": return 7;
    default:                   return 5;
  }
}
