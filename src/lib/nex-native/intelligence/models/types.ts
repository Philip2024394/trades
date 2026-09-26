// src/lib/nex-native/intelligence/models/types.ts
//
// NEX Generation Engine · Model contract (server-only).
// -----------------------------------------------------
// Every local NEX generation model implements this interface. The engine
// (generation-engine.ts) treats models as replaceable behind this shape,
// so swapping Qwen2.5-0.5B for Phi-3.5, Granite-3.3, or a future model is
// a registry change, not an engine rewrite.
//
// A model is:
//   · a repository identifier (open-weight foundation model)
//   · a licence + provenance record
//   · a chat template
//   · a `load()` that produces a callable pipeline
//   · a `generate()` that runs one turn against the pipeline
//
// The engine is what adds:
//   · validation
//   · bounded retry / correction
//   · telemetry
//   · fallback behaviour

import "server-only";

export type NexModelRuntime = "xenova-v2" | "hf-transformers-v3";

export type NexModelLicence = {
  spdx: string;                    // e.g. "Apache-2.0", "MIT", "tongyi-qianwen-research"
  commercialUsePermitted: boolean; // hard boolean · false = production blocker
  verifiedAt: string;              // ISO date the licence was inspected on the HF model card
  source: string;                  // e.g. "hf.co/Qwen/Qwen2.5-0.5B-Instruct (2026-09-24)"
  notes?: string;                  // clarifications (e.g. "gated behind login", "research-only")
};

export type NexModelProvenance = {
  baseWeightsAuthor: string;       // e.g. "Alibaba's Qwen team"
  onnxConverter: string;           // e.g. "onnx-community", "Xenova"
  parameterCount: string;          // "0.5B", "1.5B", etc.
  quantisation: string;            // "q4", "int4", "fp16"
  approximateSizeMB: number;       // rough disk footprint after quantisation
};

export type NexChatRole = "system" | "user" | "assistant";
export type NexChatMessage = { role: NexChatRole; content: string };

export type NexModelGenerateOptions = {
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
};

export type NexModelGenerateResult = {
  text: string;
  latencyMs: number;
};

export interface NexGenerationModel {
  /** Stable identifier · e.g. "qwen2.5-0.5b-instruct". */
  readonly id: string;
  /** HuggingFace repository the model loads from. */
  readonly repositoryId: string;
  /** Which local runtime the model requires. */
  readonly runtime: NexModelRuntime;
  /** Verified licence · engine refuses to select a model with commercialUsePermitted=false. */
  readonly licence: NexModelLicence;
  /** Provenance record for reporting + acceptance. */
  readonly provenance: NexModelProvenance;
  /** Chat template dialect this model expects. */
  readonly template: "chatml" | "phi3" | "smollm" | "granite" | "llama3";

  /** Load the model into memory. Idempotent per process. */
  load(): Promise<{ ok: true; loadMs: number } | { ok: false; error: string }>;

  /** Run one chat turn through the loaded model. */
  generate(
    messages: NexChatMessage[],
    opts?: NexModelGenerateOptions
  ): Promise<{ ok: true; result: NexModelGenerateResult } | { ok: false; error: string }>;
}
