// src/lib/nex/semantic-memory/semantic-memory.test.ts
//
// WAVE-P-3 · Semantic memory contract tests
// Founder BEGIN WAVE-P-3 · 2026-09-08

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DeterministicEmbeddingProvider, createEmbeddingProvider } from "./embedding-provider";
import { JsonlVectorStore, cosine } from "./jsonl-store";
import { semanticRetrieve, blendRetrieval, ragRetrieve } from "./rag-pipeline";
import { DEFAULT_RAG_BLEND } from "./types";
import type { VectorRecord } from "./types";

let priorRoot: string | undefined;

beforeEach(() => {
  priorRoot = process.env.NEX_SEMANTIC_MEMORY_DATA_ROOT;
  const iso = mkdtempSync(path.join(tmpdir(), "nex-p3-sem-"));
  process.env.NEX_SEMANTIC_MEMORY_DATA_ROOT = iso;
});
afterEach(() => {
  if (priorRoot === undefined) delete process.env.NEX_SEMANTIC_MEMORY_DATA_ROOT;
  else process.env.NEX_SEMANTIC_MEMORY_DATA_ROOT = priorRoot;
});

// ═══════════════════════════════════════════════════════════════════
// § EMBEDDING PROVIDER (Self-Sustainment default)
// ═══════════════════════════════════════════════════════════════════

describe("§P3-EMBEDDING · deterministic default (Self-Sustainment)", () => {
  it("deterministic provider is NOT paid third-party", () => {
    const p = new DeterministicEmbeddingProvider();
    expect(p.config.is_paid_third_party).toBe(false);
    expect(p.config.provider_id).toContain("deterministic");
  });

  it("deterministic embed same-text-same-vector", async () => {
    const p = new DeterministicEmbeddingProvider();
    const e1 = await p.embed({ text: "hello world" });
    const e2 = await p.embed({ text: "hello world" });
    expect(e1.vector).toEqual(e2.vector);
  });

  it("deterministic embed different-text-different-vector", async () => {
    const p = new DeterministicEmbeddingProvider();
    const e1 = await p.embed({ text: "hello" });
    const e2 = await p.embed({ text: "goodbye" });
    expect(e1.vector).not.toEqual(e2.vector);
  });

  it("embedBatch preserves order + count", async () => {
    const p = new DeterministicEmbeddingProvider();
    const batch = await p.embedBatch({ texts: ["a", "b", "c"] });
    expect(batch.length).toBe(3);
    expect(batch[0].model_id).toBe(p.config.provider_id);
  });

  it("createEmbeddingProvider default is deterministic (self-sustained)", () => {
    const p = createEmbeddingProvider();
    expect(p.config.is_paid_third_party).toBe(false);
  });

  it("createEmbeddingProvider custom kind requires opts.custom", () => {
    expect(() => createEmbeddingProvider({ kind: "custom" })).toThrow(/custom/);
  });

  it("all embeddings are L2-normalized (unit length)", async () => {
    const p = new DeterministicEmbeddingProvider();
    const e = await p.embed({ text: "test normalization" });
    const norm = Math.sqrt(e.vector.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § COSINE
// ═══════════════════════════════════════════════════════════════════

describe("§P3-COSINE · similarity math", () => {
  it("identical vectors → 1.0", () => {
    expect(cosine([1, 0], [1, 0])).toBe(1);
  });

  it("orthogonal vectors → 0.5 (normalized from 0)", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0.5, 5);
  });

  it("opposite vectors → 0", () => {
    expect(cosine([1, 0], [-1, 0])).toBe(0);
  });

  it("length mismatch → 0", () => {
    expect(cosine([1, 0], [1, 0, 0])).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § JSONL STORE
// ═══════════════════════════════════════════════════════════════════

describe("§P3-STORE · JSONL vector store", () => {
  it("upsert + size + query round-trip", async () => {
    const store = new JsonlVectorStore();
    const provider = new DeterministicEmbeddingProvider(64);
    const e = await provider.embed({ text: "hello world" });
    const record: VectorRecord = {
      record_id: "r1",
      vector: e.vector,
      dim: e.dim,
      model_id: e.model_id,
      content: "hello world",
      metadata: { source: "test" },
      created_at_iso: new Date().toISOString(),
    };
    await store.upsert(record);
    expect(await store.size()).toBe(1);
    const results = await store.query({ vector: e.vector, top_k: 5 });
    expect(results.length).toBe(1);
    expect(results[0].record_id).toBe("r1");
    expect(results[0].score).toBeGreaterThan(0.99); // same vector = ~1.0
  });

  it("upsertBatch persists all records", async () => {
    const store = new JsonlVectorStore();
    const provider = new DeterministicEmbeddingProvider(64);
    const records: VectorRecord[] = [];
    for (const t of ["a", "b", "c"]) {
      const e = await provider.embed({ text: t });
      records.push({
        record_id: `r_${t}`, vector: e.vector, dim: e.dim, model_id: e.model_id,
        content: t, metadata: {}, created_at_iso: "x",
      });
    }
    await store.upsertBatch(records);
    expect(await store.size()).toBe(3);
  });

  it("delete removes a record", async () => {
    const store = new JsonlVectorStore();
    const provider = new DeterministicEmbeddingProvider(64);
    const e = await provider.embed({ text: "x" });
    await store.upsert({ record_id: "r1", vector: e.vector, dim: e.dim, model_id: e.model_id, content: "x", metadata: {}, created_at_iso: "x" });
    expect(await store.size()).toBe(1);
    await store.delete("r1");
    expect(await store.size()).toBe(0);
  });

  it("filter excludes non-matching metadata", async () => {
    const store = new JsonlVectorStore();
    const provider = new DeterministicEmbeddingProvider(64);
    const e = await provider.embed({ text: "x" });
    await store.upsert({ record_id: "r1", vector: e.vector, dim: e.dim, model_id: e.model_id, content: "x", metadata: { tag: "a" }, created_at_iso: "x" });
    await store.upsert({ record_id: "r2", vector: e.vector, dim: e.dim, model_id: e.model_id, content: "x", metadata: { tag: "b" }, created_at_iso: "x" });
    const filtered = await store.query({ vector: e.vector, top_k: 10, filter: (m) => m.tag === "a" });
    expect(filtered.length).toBe(1);
    expect(filtered[0].record_id).toBe("r1");
  });

  it("dim mismatch skipped silently · not fabricated", async () => {
    const store = new JsonlVectorStore();
    const p64 = new DeterministicEmbeddingProvider(64);
    const p128 = new DeterministicEmbeddingProvider(128);
    const e64 = await p64.embed({ text: "x" });
    const e128 = await p128.embed({ text: "x" });
    await store.upsert({ record_id: "r1", vector: e64.vector, dim: 64, model_id: "test-64", content: "x", metadata: {}, created_at_iso: "x" });
    const results = await store.query({ vector: e128.vector, top_k: 5 });
    expect(results.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § RAG PIPELINE · semantic + composite blend
// ═══════════════════════════════════════════════════════════════════

describe("§P3-RAG · blend semantic + composite", () => {
  it("semanticRetrieve routes through provider · returns store results", async () => {
    const store = new JsonlVectorStore();
    const provider = new DeterministicEmbeddingProvider(64);
    const e = await provider.embed({ text: "target" });
    await store.upsert({ record_id: "r1", vector: e.vector, dim: 64, model_id: provider.config.provider_id, content: "target", metadata: {}, created_at_iso: "x" });
    const results = await semanticRetrieve({ query_text: "target", top_k: 5, provider, store });
    expect(results.length).toBe(1);
  });

  it("blendRetrieval combines semantic + composite by record_id", () => {
    const out = blendRetrieval({
      semantic_results: [
        { record_id: "shared", score: 0.9, content: "c1", metadata: {}, model_id: "m" },
        { record_id: "semantic_only", score: 0.7, content: "c2", metadata: {}, model_id: "m" },
      ],
      composite_results: [
        { record_id: "shared", content: "c1", metadata: {}, composite_score: 80 },
        { record_id: "composite_only", content: "c3", metadata: {}, composite_score: 60 },
      ],
      config: { semantic_weight: 0.5, composite_weight: 0.5, min_blended_score: 0, top_k_final: 10 },
    });
    expect(out.length).toBe(3);
    const shared = out.find((r) => r.record_id === "shared");
    expect(shared?.source).toBe("both");
    expect(shared?.blended_score).toBeGreaterThan(0);
  });

  it("blend respects min_blended_score filter", () => {
    const out = blendRetrieval({
      semantic_results: [{ record_id: "low", score: 0.1, content: "x", metadata: {}, model_id: "m" }],
      composite_results: [],
      config: { semantic_weight: 0.5, composite_weight: 0.5, min_blended_score: 0.5, top_k_final: 10 },
    });
    expect(out.length).toBe(0);
  });

  it("ragRetrieve end-to-end with composite retriever function", async () => {
    const store = new JsonlVectorStore();
    const provider = new DeterministicEmbeddingProvider(64);
    const e = await provider.embed({ text: "target" });
    await store.upsert({ record_id: "r1", vector: e.vector, dim: 64, model_id: provider.config.provider_id, content: "target", metadata: {}, created_at_iso: "x" });
    const out = await ragRetrieve({
      query_text: "target",
      semantic_top_k: 5,
      composite_retriever: async () => [{ record_id: "r2", content: "other", metadata: {}, composite_score: 50 }],
      provider,
      store,
      blend_config: { ...DEFAULT_RAG_BLEND, min_blended_score: 0 },
    });
    expect(out.length).toBeGreaterThanOrEqual(1);
  });

  it("blend NEVER produces score outside [0,1]", () => {
    const out = blendRetrieval({
      semantic_results: [{ record_id: "r1", score: 1.0, content: "x", metadata: {}, model_id: "m" }],
      composite_results: [{ record_id: "r1", content: "x", metadata: {}, composite_score: 100 }],
      config: DEFAULT_RAG_BLEND,
    });
    expect(out[0].blended_score).toBeGreaterThanOrEqual(0);
    expect(out[0].blended_score).toBeLessThanOrEqual(1);
  });
});
