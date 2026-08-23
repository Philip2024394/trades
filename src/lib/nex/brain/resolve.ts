// NEX BRAIN · runtime provider resolver.
//
// Per the Router architecture doctrine (2026-08-20 · CONSTITUTIONAL):
// which provider is active for BRAIN = runtime config, not hardcoded.
// This module owns the selection logic.
//
// Session 1 scope: env-key based resolution with a stub fallback.
// Session 4a adds an opt-in Ollama branch so we can test local Qwen
// 2.5 3B quality without displacing the Anthropic default.
// Session 5+ will extend to Supabase-config-driven selection (mirrors
// the existing `ai_visualiser_provider_config` table pattern from
// `src/lib/ai-visualiser/providers/resolve.ts`) so operators can
// swap providers at runtime without a redeploy.
//
// Resolution order:
//   1. If forceStub                                → stub
//   2. If forceOllama OR NEX_BRAIN_PROVIDER=ollama → Ollama (local)
//   3. If ANTHROPIC_API_KEY present                → Anthropic Claude Opus 4.7
//   4. Otherwise                                   → stub (dev fallback)
//
// Future providers (OpenAI GPT-5, Gemini 3, additional open-source)
// plug in here as further resolution branches. The interface is
// stable — the resolver is the single dispatch point.

import type { NexBrainProvider } from "./provider";
import { createAnthropicBrainProvider, type AnthropicModelId } from "./providers/anthropic";
import { createOllamaBrainProvider, type OllamaBrainOptions } from "./providers/ollama";
import { createStubBrainProvider } from "./providers/stub";

export type NexBrainResolution = {
  provider: NexBrainProvider;
  /** True when a real (non-stub) provider was resolved. UI can gate
   *  "real capability available" states on this. */
  isLive: boolean;
  /** Why this provider was picked · used for telemetry + diagnostics. */
  reason: string;
};

export type ResolveOptions = {
  /** Override model when Anthropic is picked. Defaults to Opus 4.7
   *  for consumer-facing chat (per Phase 1 phase-plan doctrine). */
  anthropicModel?: AnthropicModelId;
  /** Force the stub even if a real provider is available. Only used
   *  in test / offline dev. Never true in production. */
  forceStub?: boolean;
  /** Explicitly pick the Ollama local provider. Session 4a diagnostic
   *  path. If truthy, the resolver skips the Anthropic branch and
   *  returns Ollama regardless of ANTHROPIC_API_KEY presence. May be
   *  a boolean (use defaults) or an OllamaBrainOptions object. */
  forceOllama?: boolean | OllamaBrainOptions;
};

/** Resolve the active NEX Brain provider. Sync + deterministic —
 *  no network, no DB. Callers may cache the result per-process. */
export function resolveNexBrain(opts: ResolveOptions = {}): NexBrainResolution {
  if (opts.forceStub) {
    return {
      provider: createStubBrainProvider(),
      isLive: false,
      reason: "force_stub",
    };
  }

  const envOllama = process.env.NEX_BRAIN_PROVIDER === "ollama";
  if (opts.forceOllama || envOllama) {
    const ollamaOpts: OllamaBrainOptions =
      typeof opts.forceOllama === "object" ? opts.forceOllama : {};
    const provider = createOllamaBrainProvider(ollamaOpts);
    return {
      provider,
      isLive: true,
      reason: opts.forceOllama
        ? `${provider.id} · forceOllama`
        : `${provider.id} · NEX_BRAIN_PROVIDER=ollama`,
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const model = opts.anthropicModel ?? "claude-opus-4-7";
    return {
      provider: createAnthropicBrainProvider(model),
      isLive: true,
      reason: `anthropic:${model} · ANTHROPIC_API_KEY present`,
    };
  }

  return {
    provider: createStubBrainProvider(),
    isLive: false,
    reason: "no_provider_configured · ANTHROPIC_API_KEY missing",
  };
}
