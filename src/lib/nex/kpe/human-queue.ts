// KPE · Human Review Queue
//
// Every decision with tier="human_review" lands here. This module closes
// the loop between the Decision Engine's abstain call and the Brain Writer.
//
// Admin flow:
//   1. GET  /api/nex/kpe/human-queue                → list pending decisions
//   2. PATCH /api/nex/kpe/human-queue               → { chunk_id, decision, admin, reason? }
//        - "approve" → write the chunk to the document's target brains
//        - "reject"  → mark as rejected, never process again
//
// Every admin action emits an Intelligence Event for the audit trail.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { DecisionRecord, ChunkRecord, DocumentRecord } from "./types";
import { appendMemory } from "../brain/router";
import { emitEventSafe } from "../events/fs-store";

const ROOT = path.join(process.cwd(), "data", "nex-kpe");
const DECISIONS_FILE = path.join(ROOT, "decisions.jsonl");
const CHUNKS_FILE    = path.join(ROOT, "chunks.jsonl");
const DOCS_FILE      = path.join(ROOT, "documents.jsonl");
const REVIEWS_FILE   = path.join(ROOT, "human_reviews.jsonl");

async function readJsonl<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const out: T[] = [];
    for (const line of raw.split("\n")) {
      if (!line) continue;
      try { out.push(JSON.parse(line) as T); } catch { /* skip */ }
    }
    return out;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

// ── Review record ────────────────────────────────────────────────

export type HumanReview = {
  review_id: string;
  chunk_id: string;
  document_id: string;
  decision: "approved" | "rejected";
  admin: string;
  reason: string | null;
  decided_at: string;
};

export type PendingReview = {
  chunk_id: string;
  document_id: string;
  chunk_content: string;
  chunk_heading_path: string[];
  chunk_token_estimate: number;
  document_title: string | null;
  document_source: string;
  classifier_label: string | null;
  classifier_confidence: number | null;
  target_brains: string[];
  decided_at: string;
  reason: string;                        // why the decision engine chose human_review
  escalation_priority: string;
};

// ── List pending ──────────────────────────────────────────────────

/**
 * Return every human_review decision that has NOT yet been approved or
 * rejected by an admin. Latest-per-chunk wins in the reviews file.
 */
export async function listPending(): Promise<PendingReview[]> {
  const [decisions, chunks, docs, reviews] = await Promise.all([
    readJsonl<DecisionRecord>(DECISIONS_FILE),
    readJsonl<ChunkRecord>(CHUNKS_FILE),
    readJsonl<DocumentRecord>(DOCS_FILE),
    readJsonl<HumanReview>(REVIEWS_FILE),
  ]);

  const reviewedChunks = new Set(reviews.map((r) => r.chunk_id));
  const chunkById = new Map(chunks.map((c) => [c.chunk_id, c]));
  const docById = new Map<string, DocumentRecord>();
  for (const d of docs) docById.set(d.document_id, d);   // latest snapshot wins

  const pending: PendingReview[] = [];
  for (const d of decisions) {
    if (d.route.tier !== "human_review") continue;
    if (reviewedChunks.has(d.chunk_id)) continue;
    const chunk = chunkById.get(d.chunk_id);
    if (!chunk) continue;
    const doc = docById.get(chunk.document_id);
    if (!doc) continue;
    pending.push({
      chunk_id: chunk.chunk_id,
      document_id: chunk.document_id,
      chunk_content: chunk.content,
      chunk_heading_path: chunk.heading_path,
      chunk_token_estimate: chunk.token_estimate,
      document_title: doc.title,
      document_source: doc.source,
      classifier_label: doc.classifier_label,
      classifier_confidence: doc.classifier_confidence,
      target_brains: doc.target_brains,
      decided_at: d.decided_at,
      reason: d.route.reason,
      escalation_priority: d.route.escalation_priority,
    });
  }
  return pending.sort((a, b) => (a.decided_at < b.decided_at ? 1 : -1));
}

// ── Admin decisions ──────────────────────────────────────────────

export async function approve(chunk_id: string, admin: string, reason?: string): Promise<{ ok: true; brains_written: string[]; memory_count: number } | { ok: false; error: string }> {
  const [chunks, docs] = await Promise.all([
    readJsonl<ChunkRecord>(CHUNKS_FILE),
    readJsonl<DocumentRecord>(DOCS_FILE),
  ]);
  const chunk = chunks.find((c) => c.chunk_id === chunk_id);
  if (!chunk) return { ok: false, error: "chunk_not_found" };
  const doc = docs.find((d) => d.document_id === chunk.document_id);
  if (!doc) return { ok: false, error: "document_not_found" };

  const targetBrains = doc.target_brains.length > 0 ? doc.target_brains : ["Content Brain"];
  const brainsWritten = new Set<string>();
  let memoryCount = 0;
  for (const brainName of targetBrains) {
    await appendMemory(brainName, {
      source_job_id: doc.document_id,
      source_kind: "kpe:human_approved",
      source_owner: admin,
      knowledge_type: doc.classifier_label,
      title: chunk.heading_path.at(-1) ?? doc.title,
      content_length: chunk.content.length,
      inbox_item_id: doc.document_id,
    });
    memoryCount += 1;
    brainsWritten.add(brainName);
  }

  await recordReview({
    review_id: crypto.randomUUID(),
    chunk_id,
    document_id: doc.document_id,
    decision: "approved",
    admin,
    reason: reason ?? null,
    decided_at: new Date().toISOString(),
  });

  emitEventSafe({
    event_type: "kpe_human_approved",
    source: "human",
    actor_id: admin,
    related_job: doc.document_id,
    related_department: "knowledge",
    outcome: "success",
    payload: { chunk_id, document_id: doc.document_id, brains_written: [...brainsWritten], memory_count: memoryCount },
  });

  return { ok: true, brains_written: [...brainsWritten], memory_count: memoryCount };
}

export async function reject(chunk_id: string, admin: string, reason?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const chunks = await readJsonl<ChunkRecord>(CHUNKS_FILE);
  const chunk = chunks.find((c) => c.chunk_id === chunk_id);
  if (!chunk) return { ok: false, error: "chunk_not_found" };

  await recordReview({
    review_id: crypto.randomUUID(),
    chunk_id,
    document_id: chunk.document_id,
    decision: "rejected",
    admin,
    reason: reason ?? null,
    decided_at: new Date().toISOString(),
  });

  emitEventSafe({
    event_type: "kpe_human_rejected",
    source: "human",
    actor_id: admin,
    related_job: chunk.document_id,
    related_department: "knowledge",
    outcome: "informational",
    payload: { chunk_id, document_id: chunk.document_id, reason },
  });

  return { ok: true };
}

async function recordReview(r: HumanReview): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.appendFile(REVIEWS_FILE, JSON.stringify(r) + "\n", "utf8");
}

// ── Stats ────────────────────────────────────────────────────────

export async function queueStats(): Promise<{ pending: number; approved_total: number; rejected_total: number }> {
  const reviews = await readJsonl<HumanReview>(REVIEWS_FILE);
  const pending = await listPending();
  return {
    pending: pending.length,
    approved_total: reviews.filter((r) => r.decision === "approved").length,
    rejected_total: reviews.filter((r) => r.decision === "rejected").length,
  };
}
