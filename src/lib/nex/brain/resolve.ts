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
import { getModelForRole, type NexModelRole } from "./model-registry";
import { createAnthropicBrainProvider, type AnthropicModelId } from "./providers/anthropic";
import { createOllamaBrainProvider, probeOllama, type OllamaBrainOptions } from "./providers/ollama";
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
  /** Explicitly pick the Ollama local provider. If truthy, the
   *  resolver skips the Anthropic branch and returns Ollama regardless
   *  of ANTHROPIC_API_KEY presence. May be a boolean (use defaults)
   *  or an OllamaBrainOptions object. */
  forceOllama?: boolean | OllamaBrainOptions;
  /** Model-registry role to resolve for. When Ollama is the active
   *  provider, this drives which model tag is loaded. Ignored when
   *  Anthropic is active (Anthropic model is set by `anthropicModel`).
   *  Default: "brain.primary_local". */
  role?: NexModelRole;
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
    const ollamaOpts: OllamaBrainOptions = ollamaOptionsFrom(opts);
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

/** Build OllamaBrainOptions from ResolveOptions · merging any
 *  explicit override with the model-registry entry for the requested
 *  role (default: brain.primary_local). */
function ollamaOptionsFrom(opts: ResolveOptions): OllamaBrainOptions {
  const override: OllamaBrainOptions =
    typeof opts.forceOllama === "object" ? opts.forceOllama : {};
  if (override.model) return override; // explicit tag wins
  const role: NexModelRole = opts.role ?? "brain.primary_local";
  return { ...override, model: getModelForRole(role).ollamaTag };
}

/** Async variant that probes Ollama before committing to it. When
 *  Ollama is the selected provider (via NEX_BRAIN_PROVIDER=ollama or
 *  forceOllama) but the server is unreachable or the model isn't
 *  installed, this falls through to the next provider in the chain
 *  (Anthropic if ANTHROPIC_API_KEY is present, otherwise stub).
 *
 *  Use this from request-handling code that can afford a ~3 ms probe
 *  and needs Ollama-down resilience. The sync `resolveNexBrain` stays
 *  for callers that already know the provider is live or don't need
 *  fallback (e.g. one-shot scripts). */
export async function resolveNexBrainWithFallback(
  opts: ResolveOptions = {},
): Promise<NexBrainResolution> {
  const envOllama = process.env.NEX_BRAIN_PROVIDER === "ollama";
  const wantOllama = Boolean(opts.forceOllama) || envOllama;

  if (opts.forceStub || !wantOllama) {
    return resolveNexBrain(opts);
  }

  const ollamaOpts: OllamaBrainOptions = ollamaOptionsFrom(opts);
  const probe = await probeOllama({ url: ollamaOpts.url, model: ollamaOpts.model });

  if (probe.ok && probe.modelInstalled) {
    const provider = createOllamaBrainProvider(ollamaOpts);
    return {
      provider,
      isLive: true,
      reason: `${provider.id} · ${envOllama ? "NEX_BRAIN_PROVIDER=ollama" : "forceOllama"} · probe ok`,
    };
  }

  // Ollama unavailable · fall through to Anthropic if configured.
  if (process.env.ANTHROPIC_API_KEY) {
    const model = opts.anthropicModel ?? "claude-opus-4-7";
    const why = probe.ok
      ? `ollama model '${probe.selectedModel}' not installed (installed: ${probe.models.join(", ") || "none"})`
      : `ollama unreachable (${probe.error})`;
    return {
      provider: createAnthropicBrainProvider(model),
      isLive: true,
      reason: `anthropic:${model} · fallback from Ollama · ${why}`,
    };
  }

  // No fallback available · return stub so the caller can surface a
  // meaningful error rather than crash.
  return {
    provider: createStubBrainProvider(),
    isLive: false,
    reason: `stub · Ollama unavailable (${probe.ok ? "model missing" : probe.error}) and no ANTHROPIC_API_KEY set`,
  };
}
