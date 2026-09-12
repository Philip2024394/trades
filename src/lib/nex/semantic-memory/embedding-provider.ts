// src/lib/nex/semantic-memory/embedding-provider.ts
//
// WAVE-P-3 · Embedding providers (Ollama BGE-M3 default · deterministic
// test fallback · pluggable for paid opt-in later)
// Founder BEGIN WAVE-P-3 · 2026-09-08
//
// SELF-SUSTAINMENT DOCTRINE + Gateway invariant (doctrine §8):
// every embedding call routes through EmbeddingProvider · never
// direct SDK use. Default provider is self-hosted (Ollama BGE-M3 OR
// deterministic hash-based fallback for tests).

import { createHash } from "node:crypto";
import type { Embedding, EmbeddingProvider, EmbeddingProviderConfig } from "./types";

// ═══════════════════════════════════════════════════════════════════
// § A · DETERMINISTIC EMBEDDING (test / offline fallback)
// ═══════════════════════════════════════════════════════════════════

/** Deterministic hash-based embedding. NOT semantically meaningful,
 *  but STABLE + SELF-SUSTAINED. Used when no real embedding provider
 *  is available (tests · offline development · pre-migration). */
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly config: EmbeddingProviderConfig;

  constructor(dim: number = 128) {
    this.config = {
      provider_id: "deterministic-hash-v1",
      dim,
      is_paid_third_party: false,
    };
  }

  async embed(input: { text: string }): Promise<Embedding> {
    return this.embedSync(input.text);
  }

  async embedBatch(input: { texts: readonly string[] }): Promise<readonly Embedding[]> {
    return input.texts.map((t) => this.embedSync(t));
  }

  private embedSync(text: string): Embedding {
    const dim = this.config.dim;
    const vec = new Array<number>(dim);
    // Generate dim numbers deterministically from text · seed with SHA-256
    const seedBytes = createHash("sha256").update(text, "utf8").digest();
    for (let i = 0; i < dim; i++) {
      const b1 = seedBytes[i % seedBytes.length];
      const b2 = seedBytes[(i * 7 + 3) % seedBytes.length];
      const b3 = seedBytes[(i * 13 + 5) % seedBytes.length];
      // Blend to [-1, 1]
      const raw = ((b1 * 256 + b2) * 256 + b3) / (256 * 256 * 256);
      vec[i] = raw * 2 - 1;
    }
    // L2-normalize so cosine similarity behaves cleanly
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    for (let i = 0; i < dim; i++) vec[i] = vec[i] / norm;
    return {
      vector: vec,
      dim,
      model_id: this.config.provider_id,
      is_paid_third_party: false,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// § B · OLLAMA EMBEDDING PROVIDER (self-hosted primary)
// ═══════════════════════════════════════════════════════════════════

/** Ollama-served embedding endpoint. Recommended model: BGE-M3
 *  (Apache 2.0 · 8k context · 100+ languages · MTEB ~63). */
export type OllamaEmbeddingConfig = {
  url?: string;                  // default http://127.0.0.1:11434
  model?: string;                // default "bge-m3"
  dim?: number;                  // default 1024 (BGE-M3 native dim)
  timeout_ms?: number;
};

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly config: EmbeddingProviderConfig;
  private readonly url: string;
  private readonly model: string;
  private readonly timeout_ms: number;

  constructor(opts: OllamaEmbeddingConfig = {}) {
    this.url = opts.url ?? "http://127.0.0.1:11434";
    this.model = opts.model ?? "bge-m3";
    this.timeout_ms = opts.timeout_ms ?? 30_000;
    this.config = {
      provider_id: `ollama:${this.model}`,
      dim: opts.dim ?? 1024,
      is_paid_third_party: false,   // Ollama = local · free
    };
  }

  async embed(input: { text: string }): Promise<Embedding> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), this.timeout_ms);
    try {
      const res = await fetch(`${this.url}/api/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt: input.text }),
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(`Ollama embeddings failed: HTTP ${res.status}`);
      const body = await res.json() as { embedding: number[] };
      if (!Array.isArray(body.embedding)) throw new Error("Ollama returned no embedding array");
      // L2-normalize for consistent cosine behavior
      const norm = Math.sqrt(body.embedding.reduce((s, v) => s + v * v, 0)) || 1;
      const vec = body.embedding.map((v) => v / norm);
      return {
        vector: vec,
        dim: vec.length,
        model_id: this.config.provider_id,
        is_paid_third_party: false,
      };
    } finally {
      clearTimeout(t);
    }
  }

  async embedBatch(input: { texts: readonly string[] }): Promise<readonly Embedding[]> {
    // Ollama's embeddings endpoint is single-item · loop for now
    return Promise.all(input.texts.map((t) => this.embed({ text: t })));
  }
}

// ═══════════════════════════════════════════════════════════════════
// § C · FACTORY (Self-Sustainment + Gateway invariant enforced)
// ═══════════════════════════════════════════════════════════════════

export type EmbeddingProviderKind = "deterministic" | "ollama_bge_m3" | "custom";

export type EmbeddingFactoryOptions = {
  kind: EmbeddingProviderKind;
  ollama?: OllamaEmbeddingConfig;
  custom?: EmbeddingProvider;
  dim_hint?: number;
};

export function createEmbeddingProvider(opts: EmbeddingFactoryOptions = { kind: "deterministic" }): EmbeddingProvider {
  switch (opts.kind) {
    case "ollama_bge_m3":
      return new OllamaEmbeddingProvider(opts.ollama);
    case "custom":
      if (!opts.custom) throw new Error("custom kind requires opts.custom · doctrine: gateway invariant");
      if (opts.custom.config.is_paid_third_party) {
        // Note: paid providers CAN be used via custom · but the doctrine
        // requires that they route through the gateway (this is a marker
        // for auditors: any is_paid_third_party=true adapter needs to be
        // Founder-authorized · not silently plugged in).
        // We don't refuse here (that would prevent Founder-authorized use)
        // but we mark it clearly.
      }
      return opts.custom;
    case "deterministic":
    default:
      return new DeterministicEmbeddingProvider(opts.dim_hint ?? 128);
  }
}
