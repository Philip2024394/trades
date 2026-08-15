// ADR-0044 MVP · local embedding worker.
// Model: bge-small-en-v1.5 (384-dim, MIT licence) via @xenova/transformers.
// First run downloads the model to the local HF cache (~130MB). No network
// requests after that. No external API. Aligns with Core Dependency Rule.

// The @xenova/transformers package uses ONNX Runtime under the hood.

let _pipelinePromise = null;
let _pipeline = null;
let _stats = { model: null, warmup_ms: null, embed_calls: 0, embed_total_ms: 0, batch_count: 0, dim: 384 };

async function loader() {
  if (_pipeline) return _pipeline;
  if (_pipelinePromise) return _pipelinePromise;
  const t0 = Date.now();
  _pipelinePromise = (async () => {
    // Dynamic import so this file is cheap to require when not used.
    const tx = await import('@xenova/transformers');
    tx.env.allowRemoteModels = true;
    tx.env.allowLocalModels = true;
    // bge-small-en-v1.5 quantised ONNX from Xenova mirror
    const pipeline = await tx.pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', {
      quantized: true,
    });
    _stats.model = 'Xenova/bge-small-en-v1.5 (quantised)';
    _stats.warmup_ms = Date.now() - t0;
    _pipeline = pipeline;
    return pipeline;
  })();
  return _pipelinePromise;
}

/** Embed a single string. Returns Float32Array of length 384. */
export async function embed(text) {
  const pipe = await loader();
  const t0 = Date.now();
  const out = await pipe(text, { pooling: 'mean', normalize: true });
  const vec = Float32Array.from(out.data);
  const dt = Date.now() - t0;
  _stats.embed_calls += 1;
  _stats.embed_total_ms += dt;
  return vec;
}

/** Batch embed. Returns array of Float32Array. */
export async function embedBatch(texts, { batchSize = 16, onProgress } = {}) {
  const out = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const slice = texts.slice(i, i + batchSize);
    const t0 = Date.now();
    const results = await Promise.all(slice.map(t => embed(t)));
    out.push(...results);
    _stats.batch_count += 1;
    onProgress?.({ done: out.length, total: texts.length, batch_ms: Date.now() - t0 });
  }
  return out;
}

/** Cosine similarity for normalised vectors = dot product. */
export function cosine(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/** Convert Float32Array → plain array (for JSON persistence). */
export function toArray(vec) { return Array.from(vec); }

/** Convert plain array → Float32Array (for cosine). */
export function fromArray(arr) { return Float32Array.from(arr); }

export function stats() {
  return {
    ..._stats,
    embed_avg_ms: _stats.embed_calls ? +(_stats.embed_total_ms / _stats.embed_calls).toFixed(2) : null,
  };
}
