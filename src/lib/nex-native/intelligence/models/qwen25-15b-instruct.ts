// src/lib/nex-native/intelligence/models/qwen25-15b-instruct.ts
//
// NEX Generation Engine · Qwen2.5-1.5B-Instruct model adapter (server-only).
// -------------------------------------------------------------------------
// STATUS · REGISTERED CANDIDATE · runtime evaluation pending network access
//
// Purpose: proves the NEX Generation Engine's model contract is genuinely
// model-independent · a second commercial-safe candidate plugs in through
// the SAME `NexGenerationModel` interface with zero engine changes.
//
// If the runtime successfully loads this model, engine selection is a
// registry-priority change. If runtime download fails on the current
// network, the code-level boundary is still proven (registry accepts,
// licence gate accepts, contract shape is identical).
//
// Base weights: Qwen2.5-1.5B-Instruct by Alibaba's Qwen team
// ONNX mirror:  onnx-community/Qwen2.5-1.5B-Instruct
// Licence:      Apache-2.0 · commercial use permitted
//               (verified on hf.co/Qwen/Qwen2.5-1.5B-Instruct 2026-09-24)
// Runtime:      @huggingface/transformers v4.3.0

import "server-only";
import type {
  NexGenerationModel,
  NexChatMessage,
  NexModelGenerateOptions,
} from "./types";

const REPO_ID = "onnx-community/Qwen2.5-1.5B-Instruct";
const LOAD_TIMEOUT_MS = Number(process.env.NEX_INPROCESS_LOAD_TIMEOUT_MS ?? "300000");

type Pipeline = (
  input: unknown,
  opts?: Record<string, unknown>
) => Promise<Array<{ generated_text: unknown }>>;

interface HfTransformersModule {
  pipeline: (task: string, model: string, opts?: Record<string, unknown>) => Promise<Pipeline>;
  env: { allowRemoteModels: boolean; allowLocalModels: boolean };
}

let cachedPipeline: Pipeline | null = null;
let cachedLoad: Promise<{ ok: true; loadMs: number } | { ok: false; error: string }> | null = null;

async function loadOnce(): Promise<{ ok: true; loadMs: number } | { ok: false; error: string }> {
  if (cachedLoad) return cachedLoad;
  cachedLoad = (async () => {
    const start = Date.now();
    try {
      const mod = (await import("@huggingface/transformers")) as unknown as HfTransformersModule;
      mod.env.allowRemoteModels = true;
      mod.env.allowLocalModels = true;
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`load_timeout_${LOAD_TIMEOUT_MS}ms`)), LOAD_TIMEOUT_MS)
      );
      cachedPipeline = await Promise.race([
        mod.pipeline("text-generation", REPO_ID, { dtype: "q4" }),
        timeout,
      ]);
      return { ok: true as const, loadMs: Date.now() - start };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      cachedLoad = null;
      return { ok: false as const, error: msg.slice(0, 240) };
    }
  })();
  return cachedLoad;
}

export const qwen25_15b_instruct: NexGenerationModel = {
  id: "qwen2.5-1.5b-instruct",
  repositoryId: REPO_ID,
  runtime: "hf-transformers-v3",
  licence: {
    spdx: "Apache-2.0",
    commercialUsePermitted: true,
    verifiedAt: "2026-09-24",
    source: "hf.co/Qwen/Qwen2.5-1.5B-Instruct",
    notes: "Base weights are Apache-2.0 · ONNX mirror at onnx-community/Qwen2.5-1.5B-Instruct",
  },
  provenance: {
    baseWeightsAuthor: "Alibaba's Qwen team",
    onnxConverter: "onnx-community",
    parameterCount: "1.5B",
    quantisation: "q4",
    approximateSizeMB: 1200,
  },
  template: "chatml",

  async load() {
    return loadOnce();
  },

  async generate(messages: NexChatMessage[], opts: NexModelGenerateOptions = {}) {
    const loaded = await loadOnce();
    if (!loaded.ok) return { ok: false as const, error: `model_load_failed · ${loaded.error}` };
    if (!cachedPipeline) return { ok: false as const, error: "pipeline_missing_after_load" };
    const start = Date.now();
    try {
      const raw = await cachedPipeline(messages, {
        max_new_tokens: opts.maxNewTokens ?? 400,
        temperature: opts.temperature ?? 0.35,
        top_p: opts.topP ?? 0.9,
        do_sample: true,
        return_full_text: false,
      });
      const first = Array.isArray(raw) ? raw[0] : (raw as { generated_text?: unknown });
      const gt = first?.generated_text;
      let text = "";
      if (typeof gt === "string") text = gt;
      else if (Array.isArray(gt)) {
        const last = gt[gt.length - 1] as { role?: string; content?: string };
        text = last?.content ?? "";
      }
      text = text.trim();
      const imEnd = text.indexOf("<|im_end|>");
      if (imEnd >= 0) text = text.slice(0, imEnd).trim();
      return { ok: true as const, result: { text, latencyMs: Date.now() - start } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: `generation_failed · ${msg.slice(0, 200)}` };
    }
  },
};
