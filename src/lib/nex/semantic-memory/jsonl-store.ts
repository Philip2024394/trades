// src/lib/nex/semantic-memory/jsonl-store.ts
//
// WAVE-P-3 · JSONL-backed VectorStore (self-sustained · no DB dependency)
// Founder BEGIN WAVE-P-3 · 2026-09-08
//
// Default vector store · append-only JSONL at data/semantic-memory/
// with in-memory index rebuilt on read. Not scalable past ~10k
// records but sufficient for bootstrap + tests. pgvector adapter can
// be added later via the same VectorStore interface without changing
// callers.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  VectorRecord,
  VectorStore,
  VectorQuery,
  VectorQueryResult,
} from "./types";

// ─── Path resolution ─────────────────────────────────────────

export function semanticMemoryDataRoot(): string {
  const override = process.env.NEX_SEMANTIC_MEMORY_DATA_ROOT;
  if (override && override.length > 0) return override;
  return path.join(process.cwd(), "data", "semantic-memory");
}

export function vectorLedgerPath(): string {
  return path.join(semanticMemoryDataRoot(), "vectors.jsonl");
}

// ─── Store ────────────────────────────────────────────────────

/** Simple JSONL-backed vector store · in-memory index rebuilt on read.
 *  All operations are safe for bootstrap-scale workloads (< 10k records).
 *  For production scale · swap to pgvector via a different implementation
 *  of VectorStore. */
export class JsonlVectorStore implements VectorStore {
  private cache: VectorRecord[] | null = null;

  private ensureDir(): void {
    const dir = semanticMemoryDataRoot();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  private loadAll(): VectorRecord[] {
    if (this.cache) return this.cache;
    const p = vectorLedgerPath();
    if (!existsSync(p)) { this.cache = []; return []; }
    const raw = readFileSync(p, "utf8");
    const out: VectorRecord[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      try {
        const rec = JSON.parse(t) as VectorRecord;
        if (rec && rec.record_id && Array.isArray(rec.vector)) out.push(rec);
      } catch { /* skip malformed */ }
    }
    this.cache = out;
    return out;
  }

  private invalidate(): void {
    this.cache = null;
  }

  async upsert(record: VectorRecord): Promise<void> {
    this.ensureDir();
    // Append-only · lookup latest by record_id at query time
    appendFileSync(vectorLedgerPath(), JSON.stringify(record) + "\n", "utf8");
    this.invalidate();
  }

  async upsertBatch(records: readonly VectorRecord[]): Promise<void> {
    if (records.length === 0) return;
    this.ensureDir();
    const buf = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
    appendFileSync(vectorLedgerPath(), buf, "utf8");
    this.invalidate();
  }

  async query(q: VectorQuery): Promise<readonly VectorQueryResult[]> {
    const all = this.loadAll();
    // Reduce to latest-per-record_id
    const latest = new Map<string, VectorRecord>();
    for (const r of all) latest.set(r.record_id, r);

    const results: VectorQueryResult[] = [];
    for (const r of latest.values()) {
      if (q.filter && !q.filter(r.metadata)) continue;
      if (r.dim !== q.vector.length) continue; // dimension mismatch
      const score = cosine(r.vector, q.vector);
      if (q.min_score !== undefined && score < q.min_score) continue;
      results.push({
        record_id: r.record_id,
        score,
        content: r.content,
        metadata: r.metadata,
        model_id: r.model_id,
      });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, q.top_k);
  }

  async delete(record_id: string): Promise<void> {
    // Compaction · rewrite the ledger without deleted record
    const all = this.loadAll();
    const kept = all.filter((r) => r.record_id !== record_id);
    if (kept.length === all.length) return; // nothing to do
    this.ensureDir();
    const buf = kept.map((r) => JSON.stringify(r)).join("\n") + (kept.length > 0 ? "\n" : "");
    writeFileSync(vectorLedgerPath(), buf, "utf8");
    this.invalidate();
  }

  async size(): Promise<number> {
    const all = this.loadAll();
    const ids = new Set(all.map((r) => r.record_id));
    return ids.size;
  }

  async reset(): Promise<void> {
    const p = vectorLedgerPath();
    if (existsSync(p)) writeFileSync(p, "", "utf8");
    this.invalidate();
  }
}

// ─── Cosine similarity ──────────────────────────────────────

export function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  // Clamp to [0, 1] · normalize from [-1, 1] cosine range
  const raw = dot / denom;
  return Math.max(0, Math.min(1, (raw + 1) / 2));
}
