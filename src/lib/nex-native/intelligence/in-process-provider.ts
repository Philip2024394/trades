// src/lib/nex-native/intelligence/in-process-provider.ts
//
// NEX Engine Migration Compat Layer (server-only).
// -----------------------------------------------
// This module previously wrapped @xenova/transformers v2 directly and
// exposed the local Qwen1.5-0.5B baseline as a NexBrainProvider. The NEX
// Generation Engine has since taken over that responsibility and now
// owns:
//   · model selection (see model-registry.ts)
//   · foundation model adapters (see models/*.ts)
//   · validation (see validator.ts)
//   · bounded correction / retry (see generation-engine.ts)
//   · NexBrainProvider adaptation (see nex-engine-provider.ts)
//
// The compat exports below preserve the surface the existing NEX
// conversation adapter (`nex-assistant.ts`) already imports · every
// export now routes into the NEX Engine.

import "server-only";
import type { NexBrainProvider } from "@/lib/nex/brain/provider";
import {
  createNexEngineBrainProvider,
  describeNexEngine,
} from "./nex-engine-provider";
import type { NexEngineProviderOptions } from "./nex-engine-provider";
import { selectModel } from "./model-registry";
import type { NexGenerationModel } from "./models/types";

export interface InProcessProviderOptions extends NexEngineProviderOptions {
  /** DEPRECATED · engine model is chosen by model-registry.ts. Any
   *  value passed here is ignored. */
  modelId?: string;
  maxNewTokens?: number;
  temperature?: number;
}

/**
 * Returns the NEX Engine as a NexBrainProvider. Preserves the legacy
 * export name so existing callers keep working; internally routes into
 * the model-independent NEX Engine.
 */
export function createInProcessBrainProvider(
  opts: InProcessProviderOptions = {}
): NexBrainProvider {
  return createNexEngineBrainProvider({
    role: opts.role,
    maxAttempts: opts.maxAttempts,
  });
}

/**
 * Probe the NEX Engine for availability. Actually attempts to load the
 * currently-selected model so callers see a real cold-load latency and
 * a real error message if the runtime fails.
 */
export async function probeInProcessRuntime(): Promise<{
  available: boolean;
  modelId: string;
  loadMs?: number;
  error?: string;
}> {
  const descriptor = describeNexEngine();
  if (!descriptor.modelId) {
    return {
      available: false,
      modelId: "no-model-registered",
      error: "NEX Engine has no commercial-safe model registered",
    };
  }
  const model = selectModel() as NexGenerationModel;
  const loaded = await model.load();
  if (!loaded.ok) {
    return { available: false, modelId: descriptor.modelId, error: loaded.error };
  }
  return { available: true, modelId: descriptor.modelId, loadMs: loaded.loadMs };
}

/** Return the NEX Engine's currently-selected model id (or "no-model-registered"). */
export function inProcessDefaultModelId(): string {
  return describeNexEngine().modelId ?? "no-model-registered";
}

/**
 * Prime the model in the background. Idempotent · safe to call from a
 * warm-up hook. Returns the cold-load latency on first call, cached
 * value thereafter.
 */
export async function primeInProcessRuntime(): Promise<
  { modelId: string; loadMs: number } | { error: string }
> {
  const descriptor = describeNexEngine();
  if (!descriptor.modelId) return { error: "no_model_registered" };
  const model = selectModel() as NexGenerationModel;
  const loaded = await model.load();
  if (!loaded.ok) return { error: loaded.error };
  return { modelId: descriptor.modelId, loadMs: loaded.loadMs };
}
