// src/lib/nex-native/intelligence/models/qwen25-05b-instruct.ts
//
// NEX Generation Engine · Qwen2.5-0.5B-Instruct model adapter (server-only).
// -------------------------------------------------------------------------
// STATUS · CURRENT PROVEN BACKEND (not architectural anchor)
//   · This is a REPLACEABLE COMPONENT used by the NEX Generation Engine
//     while the model search continues. The engine itself is model-independent
//     (see generation-engine.ts and models/types.ts) · nothing in the engine
//     assumes Qwen, its tokenizer, its prompt format, or its size.
//   · Everything Qwen-specific lives INSIDE this file (repository id, ONNX
//     quantisation flag, template dialect). Swapping in Phi-3.5, Granite-3.3,
//     SmolLM2-1.7B, a future NEX-trained model, or a specialist adapter is a
//     new entry in model-registry.ts — no engine change required.
//   · NEX does NOT claim to have built these weights. NEX owns the intelligence
//     architecture that operates the model.
//
// Base weights:  Qwen2.5-0.5B-Instruct by Alibaba's Qwen team
// ONNX mirror:   onnx-community/Qwen2.5-0.5B-Instruct
// Licence:       Apache-2.0 · commercial use permitted
//                verified on hf.co/Qwen/Qwen2.5-0.5B-Instruct 2026-09-24
// Runtime:       @huggingface/transformers v4.3.0 · onnxruntime-web wasm backend
// Size:          ~500MB quantised
// Template:      ChatML (v3 runtime applies it automatically when given messages)
//
// Search evidence (Stage 6C round 3+4, 2026-09-24):
//   · loaded successfully via v3 runtime (cold-load ~82s)
//   · generated 12/12 runs under the full NEX production system prompt
//     (NEX_IDENTITY + NEX_RULES + surface guidance ~3300 chars)
//   · correctly admitted uncertainty ("not mentioned in the provided context")
//   · correctly quoted actual product name and price from surface guidance
//   · no degenerate loop · no rule recitation · no mixed-language contamination
//   · Apache-2.0 licence · production-safe
//
// Under the SAME production prompt, TinyLlama-1.1B and SmolLM2-135M/360M
// showed degenerate rule-listing loops (capacity-related failure mode).
// Larger candidates (Phi-3.5, Phi-4, Granite-3.3-8B, Granite-4.x) remain
// NOT YET EVALUATED at time of this file's creation · their downloads were
// blocked by transient network conditions this session, NOT by evidence of
// poor quality. The model search continues under separate authorisation and
// any subsequent finalist plugs in through model-registry.ts.

import "server-only";
import type {
  NexGenerationModel,
  NexChatMessage,
  NexModelGenerateOptions,
} from "./types";

const REPO_ID = "onnx-community/Qwen2.5-0.5B-Instruct";
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
      cachedLoad = null; // allow retry
      return { ok: false as const, error: msg.slice(0, 240) };
    }
  })();
  return cachedLoad;
}

export const qwen25_05b_instruct: NexGenerationModel = {
  id: "qwen2.5-0.5b-instruct",
  repositoryId: REPO_ID,
  runtime: "hf-transformers-v3",
  licence: {
    spdx: "Apache-2.0",
    commercialUsePermitted: true,
    verifiedAt: "2026-09-24",
    source: "hf.co/Qwen/Qwen2.5-0.5B-Instruct",
    notes: "Base weights are Apache-2.0 · ONNX mirror at onnx-community/Qwen2.5-0.5B-Instruct",
  },
  provenance: {
    baseWeightsAuthor: "Alibaba's Qwen team",
    onnxConverter: "onnx-community",
    parameterCount: "0.5B",
    quantisation: "q4",
    approximateSizeMB: 500,
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
      // Strip any accidental trailing ChatML terminator
      const imEnd = text.indexOf("<|im_end|>");
      if (imEnd >= 0) text = text.slice(0, imEnd).trim();
      return { ok: true as const, result: { text, latencyMs: Date.now() - start } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: `generation_failed · ${msg.slice(0, 200)}` };
    }
  },
};
